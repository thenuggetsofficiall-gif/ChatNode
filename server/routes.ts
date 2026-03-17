import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { ObjectStorageService, ObjectNotFoundError } from './objectStorage';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Enable CORS for Socket.IO
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    path: "/socket.io/"
  });

  // Config - set via ENV or here
  const OWNER_EMAIL = process.env.OWNER_EMAIL || 'caydenshoults32@wsdr4.org';
  const DATA_DIR = path.join(process.cwd(), 'data');

  // Helper to load/save JSON
  const loadJSON = (filename: string, fallback: any) => {
    const p = path.join(DATA_DIR, filename);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(fallback || {} , null, 2));
      return fallback || {};
    }
    try {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    } catch (e) {
      console.error('JSON load error', filename, e);
      return fallback || {};
    }
  };
  
  const saveJSON = (filename: string, obj: any) => {
    try {
      const p = path.join(DATA_DIR, filename);
      fs.writeFileSync(p, JSON.stringify(obj, null, 2));
    } catch (error) {
      console.error(`❌ Failed to save ${filename}:`, error);
    }
  };

  // Ensure data directory exists with error handling
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`📁 Created data directory: ${DATA_DIR}`);
    }
  } catch (error) {
    console.error('❌ Failed to create data directory:', error);
    throw new Error(`Cannot create data directory: ${DATA_DIR}`);
  }

  // Data structures persisted to files
  let usersByEmail = loadJSON('users.json', {});
  let rooms = loadJSON('rooms.json', { 'General': { createdAt: Date.now() }, 'Random': { createdAt: Date.now() } });
  let messages = loadJSON('messages.json', {});
  let messageLogs = loadJSON('logs.json', []);
  let warnings = loadJSON('warnings.json', {});
  let bans = loadJSON('bans.json', {});
  let ownerList = loadJSON('owners.json', { emails: [OWNER_EMAIL] });
  let adminList = loadJSON('admins.json', { emails: [] });
  let currentBroadcast = loadJSON('broadcast.json', null);
  let userDismissals = loadJSON('dismissals.json', {});
  // DM storage: key = sorted "email1||email2", value = array of { id, fromEmail, toEmail, fromUsername, text, ts }
  let dmMessages = loadJSON('dm_messages.json', {});
  // Unread: { recipientEmail: { senderEmail: count } }
  let unreadDMs = loadJSON('unread_dms.json', {});
  // Reports: array of { id, reporterEmail, reportedEmail, reportedUsername, messageText, room, ts }
  let reports = loadJSON('reports.json', []);
  // Track connected sockets by email for real-time DM delivery
  const connectedByEmail: Record<string, Set<string>> = {};

  // Timeouts — in-memory (reset on server restart; fine for moderation)
  const timeouts: Record<string, { until: number; by: string }> = {};

  // Voice bans — persisted
  let voiceBans: string[] = loadJSON('voice_bans.json', []);
  const isVoiceBanned = (email: string) => voiceBans.includes(email.toLowerCase());

  // Email blacklist (owner only) — hides emails from admins
  let emailBlacklist: string[] = loadJSON('email_blackout.json', []);
  const isEmailBlacklisted = (email: string) => emailBlacklist.includes(email.toLowerCase());
  const HIDDEN_EMAIL = '[hidden]';

  // User info store — captures IP, user-agent, and browser details per email
  interface UserInfoEntry {
    email: string;
    username: string;
    ip: string;
    userAgent: string;
    platform: string;
    language: string;
    screenWidth: number;
    screenHeight: number;
    timezone: string;
    firstSeen: number;
    lastSeen: number;
  }
  const userInfoStore: Record<string, UserInfoEntry> = {};

  // Banned words — auto-delete message and auto-report
  const BANNED_WORDS = [
    'nigger','nigga','faggot','cracker','chink','spic','kike','wetback',
    'gook','beaner','tranny','dyke','coon','towelhead','raghead',
    'zipperhead','porch monkey','jungle bunny','spook','cripple','mongoloid','67', 
    'fag', 'nig','sixseven','67','6-7','67','67','67','67',
  ];
  const containsBannedWord = (text: string): string | null => {
    const lower = text.toLowerCase().replace(/[^a-z\s]/g, '');
    for (const w of BANNED_WORDS) { if (lower.includes(w)) return w; }
    return null;
  };
  const isTimedOut = (email: string) => { const t = timeouts[email]; return t ? Date.now() < t.until : false; };

  // Voice channels — in-memory (reset on server restart, users reconnect)
  const VOICE_CHANNELS = ['General', 'Gaming', 'Music'] as const;
  const MAX_VOICE = 50;
  interface VoiceMember { email: string; username: string; socketId: string; serverMuted: boolean; speaking: boolean; }
  const voiceChannels: Record<string, VoiceMember[]> = {};
  for (const ch of VOICE_CHANNELS) voiceChannels[ch] = [];

  const broadcastVoiceState = () => {
    const pub: Record<string, Array<{ email: string; username: string; serverMuted: boolean; speaking: boolean }>> = {};
    for (const ch of VOICE_CHANNELS) {
      pub[ch] = voiceChannels[ch].map(m => ({ email: m.email, username: m.username, serverMuted: m.serverMuted, speaking: m.speaking }));
    }
    io.emit('voiceChannelsUpdated', pub);
  };

  const saveAll = () => {
    saveJSON('users.json', usersByEmail);
    saveJSON('rooms.json', rooms);
    saveJSON('messages.json', messages);
    saveJSON('logs.json', messageLogs);
    saveJSON('warnings.json', warnings);
    saveJSON('bans.json', bans);
    saveJSON('owners.json', ownerList);
    saveJSON('voice_bans.json', voiceBans);
    saveJSON('admins.json', adminList);
    saveJSON('broadcast.json', currentBroadcast);
    saveJSON('dismissals.json', userDismissals);
    saveJSON('dm_messages.json', dmMessages);
    saveJSON('unread_dms.json', unreadDMs);
    saveJSON('reports.json', reports);
    saveJSON('email_blackout.json', emailBlacklist);
  };

  // Helper: get role of a user by email
  const getUserRole = (email: string) => {
    const e = email.toLowerCase();
    if (ownerList.emails.map((x: string) => x.toLowerCase()).includes(e)) return 'owner';
    if (adminList.emails.map((x: string) => x.toLowerCase()).includes(e)) return 'admin';
    return 'user';
  };

  const dmKey = (emailA: string, emailB: string) =>
    [emailA.toLowerCase(), emailB.toLowerCase()].sort().join('||');

  // API routes with error handling
  app.get('/api/config', (req, res) => {
    try {
      res.json({ owners: ownerList.emails, admins: adminList.emails, rooms: Object.keys(rooms) });
    } catch (error) {
      console.error('❌ Error in /api/config:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/admins', (req, res) => {
    try {
      res.json(adminList.emails);
    } catch (error) {
      console.error('❌ Error in /api/admins:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Object storage routes
  app.post("/api/objects/upload", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.get("/objects/:objectPath(*)", async (req, res) => {
    try {
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  // Profile update route
  app.put('/api/profile', (req, res) => {
    try {
      const { email, username, profileImageUrl } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      const user = usersByEmail[email.toLowerCase()];
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let updated = false;
      
      if (username && username.trim() && username.trim() !== user.username) {
        user.username = username.trim();
        updated = true;
      }

      if (profileImageUrl !== undefined && profileImageUrl !== user.profileImageUrl) {
        user.profileImageUrl = profileImageUrl;
        updated = true;
      }

      if (updated) {
        usersByEmail[email.toLowerCase()] = user;
        saveAll();
        console.log(`✅ Profile updated for ${email}:`, { username: user.username, profileImageUrl: user.profileImageUrl });
      }

      res.json({ success: true, user, updated });
    } catch (error) {
      console.error('❌ Error in /api/profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Search user by email for direct messaging
  app.get('/api/users/search', (req, res) => {
    try {
      const { email } = req.query;
      
      if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email parameter is required' });
      }

      const user = usersByEmail[email.toLowerCase()];
      if (!user) {
        return res.status(404).json({ error: 'User not found with this email address' });
      }

      // Return limited user info for security
      res.json({
        id: user.email, // Using email as ID since that's the primary key
        username: user.username,
        email: user.email,
        profileImageUrl: user.profileImageUrl
      });
    } catch (error) {
      console.error('❌ Error in /api/users/search:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('conn', socket.id);

    // join event includes {email, usernameRequested, password}
    socket.on('join', (payload, cb) => {
      try {
        const email = (payload.email || '').toLowerCase();
        let usernameReq = (payload.username || '').trim() || null;
        const password = payload.password || '';

        // Check ban
        if (bans[email]) {
          cb && cb({ ok: false, reason: 'banned', ban: bans[email] });
          return;
        }

        // Check if user exists
        let user = usersByEmail[email];
        
        if (user) {
          // Existing user - verify password
          if (user.password !== password) {
            cb && cb({ ok: false, reason: 'invalid-password', message: 'Incorrect password' });
            return;
          }
          // If username was provided, verify it matches the stored username
          if (usernameReq && usernameReq.toLowerCase() !== user.username.toLowerCase()) {
            cb && cb({ ok: false, reason: 'username-mismatch', message: 'Incorrect username for this email address' });
            return;
          }
          // Update role if they're now an owner or admin
          const lowerEmail = email.toLowerCase();
          if (ownerList.emails.map((e: string) => e.toLowerCase()).includes(lowerEmail)) {
            user.role = 'owner';
          } else if (adminList.emails.map((e: string) => e.toLowerCase()).includes(lowerEmail)) {
            user.role = 'admin';
          }
          saveAll();
        } else {
          // New user - create account with password
          if (!password.trim()) {
            cb && cb({ ok: false, reason: 'password-required', message: 'Password is required for new accounts' });
            return;
          }
          
          // choose role
          let role = 'user';
          const lowerEmail = email.toLowerCase();
          if (ownerList.emails.map((e: string) => e.toLowerCase()).includes(lowerEmail)) {
            role = 'owner';
          } else if (adminList.emails.map((e: string) => e.toLowerCase()).includes(lowerEmail)) {
            role = 'admin';
          }
          
          let chosenUsername = usernameReq;
          if (!chosenUsername) {
            // Auto-generate a unique username
            let candidate = '';
            do {
              candidate = 'user' + Math.floor(Math.random() * 90000 + 10000);
            } while (Object.values(usersByEmail).some((u: any) => u.username.toLowerCase() === candidate.toLowerCase()));
            chosenUsername = candidate;
          }

          // Check username is not already taken by another account
          const usernameTaken = Object.values(usersByEmail).some(
            (u: any) => u.username.toLowerCase() === chosenUsername!.toLowerCase()
          );
          if (usernameTaken) {
            cb && cb({ ok: false, reason: 'username-taken', message: 'That username is already taken, please choose another' });
            return;
          }

          user = { username: chosenUsername, email, role, password };
          usersByEmail[email] = user;
          saveAll();
        }

        // attach to socket
        (socket as any).data.user = user;

        // Capture IP and user-agent for owner's User Info panel
        const rawIp = (socket.handshake.headers['x-forwarded-for'] as string || socket.handshake.address || '');
        const ip = rawIp.split(',')[0].trim() || 'Unknown';
        const userAgent = socket.handshake.headers['user-agent'] || 'Unknown';
        const joinTs = Date.now();
        const existing = userInfoStore[email];
        userInfoStore[email] = {
          email,
          username: user.username,
          ip,
          userAgent,
          platform: existing?.platform || 'Unknown',
          language: existing?.language || 'Unknown',
          screenWidth: existing?.screenWidth || 0,
          screenHeight: existing?.screenHeight || 0,
          timezone: existing?.timezone || 'Unknown',
          firstSeen: existing?.firstSeen || joinTs,
          lastSeen: joinTs,
        };

        // Track connected socket by email for DM delivery
        if (!connectedByEmail[email]) connectedByEmail[email] = new Set();
        connectedByEmail[email].add(socket.id);

        // Send any unacknowledged warnings (only if not expired)
        const userWarnings = warnings[email] || [];
        const now = Date.now();
        const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
        
        // Filter out expired warnings (older than 1 hour)
        const validWarnings = userWarnings.filter((w: any) => (now - w.ts) < oneHour);
        if (validWarnings.length !== userWarnings.length) {
          warnings[email] = validWarnings;
          saveAll();
        }
        
        const unacked = validWarnings.filter((w: any) => !w.acknowledged);
        if (unacked.length) {
          // send first unacknowledged
          socket.emit('warning', unacked[0]);
        }

        // send room list and recent messages
        const roomList = Object.keys(rooms);
        socket.emit('rooms', roomList);

        // join default room (but don't force)
        cb && cb({ ok: true, user, rooms: roomList });
      } catch (e) {
        console.error('join err', e);
        cb && cb({ ok: false });
      }
    });

    // create room
    socket.on('createRoom', (roomName, cb) => {
      if (!roomName) return cb && cb({ ok: false, err: 'name' });
      if (rooms[roomName]) return cb && cb({ ok: false, err: 'exists' });
      rooms[roomName] = { createdAt: Date.now() };
      saveAll();
      io.emit('rooms', Object.keys(rooms));
      cb && cb({ ok: true });
    });

    // request to fetch messages for a room
    socket.on('getMessages', (roomName, cb) => {
      const roomMsgs = messages[roomName] || [];
      cb && cb({ ok: true, messages: roomMsgs });
    });

    // send message
    socket.on('message', (payload, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      if (bans[user.email]) return cb && cb({ ok: false, err: 'banned' });
      if (isTimedOut(user.email)) {
        const t = timeouts[user.email];
        return cb && cb({ ok: false, err: 'timed-out', until: t.until });
      }

      // Ensure user has acknowledged warnings? We block sending if there's unacked warnings
      // But first, filter out expired warnings (older than 1 hour)
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const userWarnings = warnings[user.email] || [];
      const validWarnings = userWarnings.filter((w: any) => (now - w.ts) < oneHour);
      
      if (validWarnings.length !== userWarnings.length) {
        warnings[user.email] = validWarnings;
        saveAll();
      }
      
      const unacked = validWarnings.some((w: any) => !w.acknowledged);
      if (unacked) return cb && cb({ ok: false, err: 'warning' });

      const room = payload.room || 'General';
      const text = String(payload.text || '').trim();
      if (!text) return cb && cb({ ok: false, err: 'empty' });

      // Banned word check — block, auto-report, do NOT broadcast
      const bannedWord = containsBannedWord(text);
      if (bannedWord) {
        const report = {
          id: `auto-${Date.now()}`,
          reporterEmail: 'automod',
          reporterUsername: 'AutoMod',
          reportedEmail: user.email,
          reportedUsername: user.username,
          messageText: text,
          room,
          ts: Date.now(),
          reason: `Banned slur detected`,
          autoReported: true,
        };
        reports.push(report);
        if (reports.length > 1000) reports.splice(0, reports.length - 1000);
        saveAll();
        return cb && cb({ ok: false, err: 'banned-word' });
      }

      const display = (user.role === 'owner') ? `${user.username} [OWNER]` : (user.role === 'admin') ? `${user.username} [ADMIN]` : user.username;
      const replyTo = payload.replyTo ? {
        display: payload.replyTo.display,
        text: payload.replyTo.text,
        email: payload.replyTo.email
      } : undefined;
      const msg: any = { display, text, email: user.email, role: user.role, profileImageUrl: user.profileImageUrl, ts: Date.now() };
      if (replyTo) msg.replyTo = replyTo;

      if (!messages[room]) messages[room] = [];
      messages[room].push(msg);
      messageLogs.push(Object.assign({ room, username: user.username }, msg));

      // keep logs reasonable - trim
      if (messageLogs.length > 2000) messageLogs.splice(0, messageLogs.length - 2000);

      saveAll();

      io.emit('message', { room, msg }); // broadcast
      cb && cb({ ok: true });
    });

    // moderation actions (warn, ban, unban) - only admins or owner
    socket.on('warnUser', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });

      const targetEmail = (data.email || '').toLowerCase();
      const reason = String(data.reason || 'No reason provided').slice(0, 1000);
      if (!targetEmail) return cb && cb({ ok: false });

      // Owners cannot be warned by anyone
      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') {
        return cb && cb({ ok: false, err: 'cannot-warn-owner', message: 'Cannot warn an owner' });
      }
      // Admins cannot be warned by other admins (only owners can)
      if (targetRole === 'admin' && user.role !== 'owner') {
        return cb && cb({ ok: false, err: 'cannot-warn-admin', message: 'Admins cannot warn other admins' });
      }

      if (!warnings[targetEmail]) warnings[targetEmail] = [];
      warnings[targetEmail].push({ reason, issuer: user.email, ts: Date.now(), acknowledged: false });
      saveAll();

      // If the target user is connected, send them a warning event
      const sockets = Array.from(io.of('/').sockets.values());
      for (const s of sockets) {
        if ((s as any).data.user && (s as any).data.user.email === targetEmail) {
          s.emit('warning', warnings[targetEmail].slice(-1)[0]);
        }
      }

      cb && cb({ ok: true });
    });

    socket.on('ackWarning', (cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false });

      const arr = warnings[user.email] || [];
      for (let w of arr) {
        if (!w.acknowledged) {
          w.acknowledged = true;
          break;
        }
      }
      saveAll();
      cb && cb({ ok: true });
    });

    socket.on('banUser', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });

      const targetEmail = (data.email || '').toLowerCase();
      const reason = String(data.reason || 'No reason provided').slice(0, 1000);
      if (!targetEmail) return cb && cb({ ok: false });

      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') {
        return cb && cb({ ok: false, err: 'cannot-ban-owner', message: 'Cannot ban an owner' });
      }
      if (targetRole === 'admin' && user.role !== 'owner') {
        return cb && cb({ ok: false, err: 'cannot-ban-admin', message: 'Admins cannot ban other admins' });
      }

      bans[targetEmail] = { reason, issuer: user.email, ts: Date.now() };
      saveAll();

      // if connected, kick them (emit banned event then disconnect)
      const sockets = Array.from(io.of('/').sockets.values());
      for (const s of sockets) {
        if ((s as any).data.user && (s as any).data.user.email === targetEmail) {
          s.emit('banned', bans[targetEmail]);
          s.disconnect(true);
        }
      }

      cb && cb({ ok: true });
    });

    socket.on('unbanUser', (email, cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      email = (email || '').toLowerCase();
      if (!bans[email]) return cb && cb({ ok: false, err: 'notfound' });
      delete bans[email];
      saveAll();
      cb && cb({ ok: true });
    });

    // admin queries
    socket.on('getLogs', (cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const isOwner = user.role === 'owner';
      const logs = messageLogs.slice().reverse().slice(0, 500).map((log: any) => ({
        ...log,
        email: !isOwner && isEmailBlacklisted(log.email) ? HIDDEN_EMAIL : log.email,
      }));
      cb && cb({ ok: true, logs });
    });

    socket.on('getBans', (cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const isOwner = user.role === 'owner';
      if (isOwner) {
        cb && cb({ ok: true, bans });
      } else {
        const maskedBans: Record<string, any> = {};
        for (const [email, ban] of Object.entries(bans)) {
          const displayEmail = isEmailBlacklisted(email) ? HIDDEN_EMAIL : email;
          maskedBans[displayEmail] = ban;
        }
        cb && cb({ ok: true, bans: maskedBans });
      }
    });

    // Get all registered users (admin+)
    socket.on('getUsers', (cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const isOwner = user.role === 'owner';
      const now = Date.now();
      const allUsers = Object.values(usersByEmail).map((u: any) => ({
        email: !isOwner && isEmailBlacklisted(u.email) ? HIDDEN_EMAIL : u.email,
        username: u.username,
        role: getUserRole(u.email),
        timedOut: isTimedOut(u.email),
        timedOutUntil: timeouts[u.email] && now < timeouts[u.email].until ? timeouts[u.email].until : null,
        voiceBanned: isVoiceBanned(u.email),
      }));
      cb && cb({ ok: true, users: allUsers });
    });

    // ── Timeout ────────────────────────────────────────────────
    socket.on('timeoutUser', (data: { email: string; duration: number }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      if (!targetEmail || !data?.duration) return cb && cb({ ok: false, err: 'bad-data' });
      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') return cb && cb({ ok: false, err: 'cannot-timeout-owner' });
      if (targetRole === 'admin' && actor.role !== 'owner') return cb && cb({ ok: false, err: 'cannot-timeout-admin' });
      const until = Date.now() + data.duration;
      timeouts[targetEmail] = { until, by: actor.email };
      // Notify target if connected
      for (const s of Array.from(io.of('/').sockets.values())) {
        if ((s as any).data.user?.email === targetEmail) {
          s.emit('timedOut', { until, by: actor.username });
        }
      }
      cb && cb({ ok: true, until });
    });

    socket.on('removeTimeout', (data: { email: string }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      delete timeouts[targetEmail];
      for (const s of Array.from(io.of('/').sockets.values())) {
        if ((s as any).data.user?.email === targetEmail) {
          s.emit('timeoutRemoved');
        }
      }
      cb && cb({ ok: true });
    });

    // ── Voice Ban ──────────────────────────────────────────────
    socket.on('voiceBanUser', (data: { email: string }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') return cb && cb({ ok: false, err: 'cannot-vban-owner' });
      if (targetRole === 'admin' && actor.role !== 'owner') return cb && cb({ ok: false, err: 'cannot-vban-admin' });
      if (!voiceBans.includes(targetEmail)) voiceBans.push(targetEmail);
      // Kick from VC if currently in one
      removeFromVoice(targetEmail, '');
      broadcastVoiceState();
      for (const s of Array.from(io.of('/').sockets.values())) {
        if ((s as any).data.user?.email === targetEmail) {
          s.emit('voiceKicked', { reason: 'You have been voice banned' });
        }
      }
      saveAll();
      cb && cb({ ok: true });
    });

    socket.on('voiceUnbanUser', (data: { email: string }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      voiceBans = voiceBans.filter(e => e !== targetEmail);
      saveAll();
      cb && cb({ ok: true });
    });

    // ── Role Management (owner only) ────────────────────────────
    socket.on('setRole', (data: { email: string; role: 'user' | 'admin' | 'owner' }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || actor.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      const newRole = data?.role;
      if (!['user', 'admin', 'owner'].includes(newRole)) return cb && cb({ ok: false, err: 'bad-role' });
      if (targetEmail === actor.email) return cb && cb({ ok: false, err: 'cannot-change-self' });

      // Update admin list
      if (newRole === 'admin') {
        if (!adminList.includes(targetEmail)) adminList.push(targetEmail);
        ownerList = ownerList.filter((e: string) => e !== targetEmail);
      } else if (newRole === 'owner') {
        if (!ownerList.includes(targetEmail)) ownerList.push(targetEmail);
        adminList = adminList.filter((e: string) => e !== targetEmail);
      } else {
        // 'user'
        adminList = adminList.filter((e: string) => e !== targetEmail);
        ownerList = ownerList.filter((e: string) => e !== targetEmail);
      }
      saveAll();

      // Update the connected user's live session role
      for (const s of Array.from(io.of('/').sockets.values())) {
        if ((s as any).data.user?.email === targetEmail) {
          (s as any).data.user.role = newRole;
          s.emit('roleChanged', { role: newRole });
        }
      }
      cb && cb({ ok: true });
    });

    // ── Email Blacklist (owner only) ────────────────────────────
    socket.on('getEmailBlacklist', (cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      cb && cb({ ok: true, blacklist: emailBlacklist });
    });

    socket.on('addEmailBlacklist', (data: { email: string }, cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      const target = (data?.email || '').toLowerCase().trim();
      if (!target) return cb && cb({ ok: false, err: 'bad-data' });
      if (!emailBlacklist.includes(target)) emailBlacklist.push(target);
      saveAll();
      cb && cb({ ok: true });
    });

    socket.on('removeEmailBlacklist', (data: { email: string }, cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      const target = (data?.email || '').toLowerCase().trim();
      emailBlacklist = emailBlacklist.filter(e => e !== target);
      saveAll();
      cb && cb({ ok: true });
    });

    // Client sends additional browser/device details after login
    socket.on('clientInfo', (data: { platform: string; language: string; screenWidth: number; screenHeight: number; timezone: string }) => {
      const user = (socket as any).data.user;
      if (!user) return;
      const email = user.email.toLowerCase();
      if (userInfoStore[email]) {
        userInfoStore[email].platform = data?.platform || 'Unknown';
        userInfoStore[email].language = data?.language || 'Unknown';
        userInfoStore[email].screenWidth = data?.screenWidth || 0;
        userInfoStore[email].screenHeight = data?.screenHeight || 0;
        userInfoStore[email].timezone = data?.timezone || 'Unknown';
        userInfoStore[email].lastSeen = Date.now();
      }
    });

    // Owner-only: get all collected user info
    socket.on('getUserInfo', (cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      const entries = Object.values(userInfoStore).sort((a, b) => b.lastSeen - a.lastSeen);
      cb && cb({ ok: true, users: entries });
    });

    // Report a message
    socket.on('reportMessage', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });

      const { reportedEmail, reportedUsername, messageText, room } = data || {};
      if (!reportedEmail || !messageText) return cb && cb({ ok: false, err: 'missing-data' });

      const report = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        reporterEmail: user.email,
        reporterUsername: user.username,
        reportedEmail,
        reportedUsername: reportedUsername || reportedEmail,
        messageText,
        room: room || 'unknown',
        ts: Date.now(),
      };
      reports.push(report);
      if (reports.length > 1000) reports.splice(0, reports.length - 1000);
      saveAll();
      cb && cb({ ok: true });
    });

    // Get reported messages (admin+)
    socket.on('getReports', (cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      cb && cb({ ok: true, reports: reports.slice().reverse().slice(0, 500) });
    });

    socket.on('getAllUsers', (cb) => {
      const user = (socket as any).data.user;
      // Only owner can access password management
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });
      
      const allUsers = Object.values(usersByEmail).map((u: any) => ({
        id: u.email, // use email as ID for uniqueness
        email: u.email,
        username: u.username,
        password: u.password,
        role: u.role
      }));
      
      cb && cb({ ok: true, users: allUsers });
    });

    // ── Voice Channels ───────────────────────────────────────────
    const removeFromVoice = (emailToRemove: string, removedSocketId?: string) => {
      for (const ch of VOICE_CHANNELS) {
        const idx = voiceChannels[ch].findIndex(m => m.email === emailToRemove);
        if (idx !== -1) {
          const [removed] = voiceChannels[ch].splice(idx, 1);
          const sid = removedSocketId || removed.socketId;
          for (const member of voiceChannels[ch]) {
            io.to(member.socketId).emit('voicePeerLeft', { socketId: sid, email: emailToRemove });
          }
          break;
        }
      }
    };

    socket.on('getVoiceChannels', (cb) => {
      const pub: Record<string, any[]> = {};
      for (const ch of VOICE_CHANNELS) {
        pub[ch] = voiceChannels[ch].map(m => ({ email: m.email, username: m.username, serverMuted: m.serverMuted, speaking: m.speaking }));
      }
      cb && cb({ ok: true, channels: pub });
    });

    socket.on('joinVoiceChannel', (data: { channelId: string }, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      if (isVoiceBanned(user.email)) return cb && cb({ ok: false, err: 'voice-banned' });
      if (isTimedOut(user.email)) return cb && cb({ ok: false, err: 'timed-out', until: timeouts[user.email].until });
      const channelId = data?.channelId;
      if (!VOICE_CHANNELS.includes(channelId as any)) return cb && cb({ ok: false, err: 'bad-channel' });
      const channel = voiceChannels[channelId];
      if (channel.length >= MAX_VOICE) return cb && cb({ ok: false, err: 'full' });

      // Remove from any other channel first
      removeFromVoice(user.email, socket.id);

      const existing = channel.map(m => ({ socketId: m.socketId, email: m.email, username: m.username }));
      channel.push({ email: user.email, username: user.username, socketId: socket.id, serverMuted: false, speaking: false });

      for (const member of existing) {
        io.to(member.socketId).emit('voicePeerJoined', { socketId: socket.id, email: user.email, username: user.username });
      }
      broadcastVoiceState();
      cb && cb({ ok: true, channelId, existingPeers: existing });
    });

    socket.on('leaveVoiceChannel', (cb) => {
      const user = (socket as any).data.user;
      if (user?.email) removeFromVoice(user.email, socket.id);
      broadcastVoiceState();
      cb && cb({ ok: true });
    });

    // Client reports their speaking state
    socket.on('voiceSpeaking', (data: { speaking: boolean }) => {
      const user = (socket as any).data.user;
      if (!user) return;
      for (const ch of VOICE_CHANNELS) {
        const member = voiceChannels[ch].find(m => m.email === user.email);
        if (member) {
          member.speaking = !!data.speaking;
          broadcastVoiceState();
          break;
        }
      }
    });

    // Admin: disconnect a user from voice
    socket.on('kickFromVoice', (data: { email: string }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') return cb && cb({ ok: false, err: 'cannot-kick-owner' });
      if (targetRole === 'admin' && actor.role !== 'owner') return cb && cb({ ok: false, err: 'cannot-kick-admin' });

      // Find target socket and emit kick event
      for (const ch of VOICE_CHANNELS) {
        const member = voiceChannels[ch].find(m => m.email === targetEmail);
        if (member) {
          io.to(member.socketId).emit('voiceKicked', { reason: 'Disconnected by moderator' });
          removeFromVoice(targetEmail, member.socketId);
          broadcastVoiceState();
          break;
        }
      }
      cb && cb({ ok: true });
    });

    // Admin: server-mute a user in voice
    socket.on('serverMuteVoice', (data: { email: string; muted: boolean }, cb) => {
      const actor = (socket as any).data.user;
      if (!actor || (actor.role !== 'admin' && actor.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      const targetEmail = (data?.email || '').toLowerCase();
      const targetRole = getUserRole(targetEmail);
      if (targetRole === 'owner') return cb && cb({ ok: false, err: 'cannot-mute-owner' });
      if (targetRole === 'admin' && actor.role !== 'owner') return cb && cb({ ok: false, err: 'cannot-mute-admin' });

      for (const ch of VOICE_CHANNELS) {
        const member = voiceChannels[ch].find(m => m.email === targetEmail);
        if (member) {
          member.serverMuted = !!data.muted;
          io.to(member.socketId).emit('voiceServerMuted', { muted: member.serverMuted });
          broadcastVoiceState();
          break;
        }
      }
      cb && cb({ ok: true });
    });

    // Relay WebRTC signaling between peers
    socket.on('voiceSignal', (data: { targetSocketId: string; signal: any }) => {
      if (!data?.targetSocketId || !data?.signal) return;
      io.to(data.targetSocketId).emit('voiceSignal', { fromSocketId: socket.id, signal: data.signal });
    });

    // Broadcast system - owner only
    socket.on('createBroadcast', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'no-perm' });

      const message = String(data.message || '').trim();
      if (!message) return cb && cb({ ok: false, err: 'empty' });

      // Create new broadcast
      currentBroadcast = {
        id: Date.now(),
        message,
        createdAt: Date.now(),
        expiresAt: Date.now() + (60 * 60 * 1000), // 1 hour
        createdBy: user.email
      };

      // Clear all dismissals when new broadcast is created
      userDismissals = {};
      
      saveAll();

      // Broadcast to all connected clients
      io.emit('broadcast', currentBroadcast);
      cb && cb({ ok: true, broadcast: currentBroadcast });
    });

    // Get current broadcast for newly connected users
    socket.on('getBroadcast', (cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });

      // Check if broadcast is expired
      if (currentBroadcast && Date.now() > currentBroadcast.expiresAt) {
        currentBroadcast = null;
        saveAll();
      }

      // Check if user has dismissed this broadcast
      const isDismissed = currentBroadcast && userDismissals[user.email] === currentBroadcast.id;
      
      cb && cb({ 
        ok: true, 
        broadcast: currentBroadcast && !isDismissed ? currentBroadcast : null 
      });
    });

    // Dismiss broadcast for current user only
    socket.on('dismissBroadcast', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });

      const broadcastId = data.broadcastId;
      if (!broadcastId || !currentBroadcast || currentBroadcast.id !== broadcastId) {
        return cb && cb({ ok: false, err: 'invalid-broadcast' });
      }

      // Mark as dismissed for this user
      userDismissals[user.email] = broadcastId;
      saveAll();

      cb && cb({ ok: true });
    });

    // ── Direct Message Events (file-based, email-keyed) ──

    // Search user by username to start a DM
    socket.on('startDMByUsername', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      const { username } = data || {};
      if (!username) return cb && cb({ ok: false, err: 'missing-username' });

      const target = Object.values(usersByEmail).find(
        (u: any) => u.username.toLowerCase() === username.trim().toLowerCase()
      ) as any;
      if (!target) return cb && cb({ ok: false, err: 'user-not-found', message: 'No user found with that username' });
      if (target.email === user.email) return cb && cb({ ok: false, err: 'self-message', message: 'You cannot message yourself' });

      cb && cb({ ok: true, data: { user: { email: target.email, username: target.username, profileImageUrl: target.profileImageUrl } } });
    });

    // Get all DM conversations for current user
    socket.on('getDirectConversations', (cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });

      const myEmail = user.email.toLowerCase();
      const seen = new Set<string>();
      const convs: any[] = [];

      for (const key of Object.keys(dmMessages)) {
        const parts = key.split('||');
        if (!parts.includes(myEmail)) continue;
        const otherEmail = parts[0] === myEmail ? parts[1] : parts[0];
        if (seen.has(otherEmail)) continue;
        seen.add(otherEmail);

        const msgs: any[] = dmMessages[key] || [];
        if (msgs.length === 0) {
          // Still include conversations with no messages (just started)
          const otherUser = usersByEmail[otherEmail] as any;
          const unread = (unreadDMs[myEmail] || {})[otherEmail] || 0;
          convs.push({
            userId: otherEmail,
            username: otherUser?.username || otherEmail,
            lastMessage: '',
            timestamp: new Date(0),
            unread
          });
          continue;
        }

        const last = msgs[msgs.length - 1];
        const otherUser = usersByEmail[otherEmail] as any;
        const unread = (unreadDMs[myEmail] || {})[otherEmail] || 0;
        convs.push({
          userId: otherEmail,
          username: otherUser?.username || otherEmail,
          lastMessage: last.text,
          timestamp: new Date(last.ts),
          unread
        });
      }

      convs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      cb && cb({ ok: true, conversations: convs });
    });

    // Get messages between current user and another user by email
    socket.on('getDirectMessages', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      const { otherEmail } = data || {};
      if (!otherEmail) return cb && cb({ ok: false, err: 'missing-email' });

      const key = dmKey(user.email, otherEmail);
      const msgs = dmMessages[key] || [];
      cb && cb({ ok: true, messages: msgs });
    });

    // Mark DMs from a user as read
    socket.on('markDMRead', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      const { otherEmail } = data || {};
      if (!otherEmail) return cb && cb({ ok: false, err: 'missing-email' });

      if (unreadDMs[user.email]) {
        delete unreadDMs[user.email][otherEmail.toLowerCase()];
        saveAll();
      }
      cb && cb({ ok: true });
    });

    // Send a direct message
    socket.on('sendDirectMessage', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user) return cb && cb({ ok: false, err: 'not-authed' });
      if (bans[user.email]) return cb && cb({ ok: false, err: 'banned' });

      // Check for unacked warnings
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const userWarnings = warnings[user.email] || [];
      const validWarnings = userWarnings.filter((w: any) => (now - w.ts) < oneHour);
      if (validWarnings.length !== userWarnings.length) {
        warnings[user.email] = validWarnings;
      }
      const unacked = validWarnings.some((w: any) => !w.acknowledged);
      if (unacked) return cb && cb({ ok: false, err: 'warning' });

      const { toEmail, text } = data || {};
      if (!toEmail || !String(text || '').trim()) return cb && cb({ ok: false, err: 'missing-data' });

      const targetUser = usersByEmail[toEmail.toLowerCase()] as any;
      if (!targetUser) return cb && cb({ ok: false, err: 'user-not-found' });

      const key = dmKey(user.email, toEmail);
      if (!dmMessages[key]) dmMessages[key] = [];

      const msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fromEmail: user.email,
        toEmail: toEmail.toLowerCase(),
        fromUsername: user.username,
        text: String(text).trim(),
        ts: Date.now()
      };
      dmMessages[key].push(msg);

      // Increment unread count for recipient (if they're not in DM with sender right now)
      const recipientEmail = toEmail.toLowerCase();
      if (!unreadDMs[recipientEmail]) unreadDMs[recipientEmail] = {};
      unreadDMs[recipientEmail][user.email] = (unreadDMs[recipientEmail][user.email] || 0) + 1;

      saveAll();

      // Emit to all recipient sockets
      const recipientSockets = Array.from(connectedByEmail[recipientEmail] || []);
      for (const sid of recipientSockets) {
        io.to(sid).emit('directMessage', msg);
      }

      // Also emit to sender's other sockets (if open in multiple tabs)
      const senderSockets = Array.from(connectedByEmail[user.email] || []);
      for (const sid of senderSockets) {
        if (sid !== socket.id) io.to(sid).emit('directMessage', msg);
      }

      cb && cb({ ok: true, message: msg });
    });

    // Get list of admins (owner only)
    socket.on('getAdmins', (cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'not-owner' });
      const adminUsers = adminList.emails.map((email: string) => ({
        email,
        username: (usersByEmail[email] as any)?.username || email
      }));
      cb && cb({ ok: true, admins: adminUsers });
    });

    // Set or remove admin (owner only)
    socket.on('setAdmin', (data, cb) => {
      const user = (socket as any).data.user;
      if (!user || user.role !== 'owner') return cb && cb({ ok: false, err: 'not-owner' });
      
      const { identifier, action } = data;
      if (!identifier || !action) return cb && cb({ ok: false, err: 'missing-data' });
      
      // Find user by email or username
      let targetUser: any = usersByEmail[identifier.toLowerCase()];
      if (!targetUser) {
        targetUser = Object.values(usersByEmail).find(
          (u: any) => u.username.toLowerCase() === identifier.toLowerCase()
        );
      }
      
      if (!targetUser) {
        return cb && cb({ ok: false, err: 'user-not-found', message: 'No user found with that email or username' });
      }
      if (ownerList.emails.map((e: string) => e.toLowerCase()).includes(targetUser.email.toLowerCase())) {
        return cb && cb({ ok: false, err: 'is-owner', message: 'Cannot change role of an owner' });
      }
      
      if (action === 'add') {
        if (!adminList.emails.includes(targetUser.email)) {
          adminList.emails.push(targetUser.email);
        }
        targetUser.role = 'admin';
      } else {
        adminList.emails = adminList.emails.filter((e: string) => e !== targetUser.email);
        targetUser.role = 'user';
      }
      saveAll();
      
      const adminUsers = adminList.emails.map((email: string) => ({
        email,
        username: (usersByEmail[email] as any)?.username || email
      }));
      cb && cb({ ok: true, admins: adminUsers });
    });

    socket.on('disconnect', () => {
      const user = (socket as any).data?.user;
      if (user?.email) {
        const sockets = connectedByEmail[user.email];
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) delete connectedByEmail[user.email];
        }
        // Clean up voice channels
        const wasInVoice = VOICE_CHANNELS.some(ch => voiceChannels[ch].some(m => m.socketId === socket.id));
        if (wasInVoice) {
          removeFromVoice(user.email, socket.id);
          broadcastVoiceState();
        }
      }
    });
  });

  return httpServer;
}
