import type { Express } from "express";
import { createServer, type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";

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

  // Ensure data directory exists
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

  // Helper to load/save JSON
  function loadJSON(filename: string, fallback: any) {
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
  }
  function saveJSON(filename: string, obj: any) {
    const p = path.join(DATA_DIR, filename);
    fs.writeFileSync(p, JSON.stringify(obj, null, 2));
  }

  // Data structures persisted to files
  let usersByEmail = loadJSON('users.json', {});
  let rooms = loadJSON('rooms.json', { 'General': { createdAt: Date.now() }, 'Random': { createdAt: Date.now() } });
  let messages = loadJSON('messages.json', {});
  let messageLogs = loadJSON('logs.json', []);
  let warnings = loadJSON('warnings.json', {});
  let bans = loadJSON('bans.json', {});
  let adminList = loadJSON('admins.json', { emails: [] });

  function saveAll() {
    saveJSON('users.json', usersByEmail);
    saveJSON('rooms.json', rooms);
    saveJSON('messages.json', messages);
    saveJSON('logs.json', messageLogs);
    saveJSON('warnings.json', warnings);
    saveJSON('bans.json', bans);
    saveJSON('admins.json', adminList);
  }

  // API routes
  app.get('/api/config', (req, res) => {
    res.json({ ownerEmail: OWNER_EMAIL, admins: adminList.emails, rooms: Object.keys(rooms) });
  });

  app.get('/api/admins', (req, res) => {
    res.json(adminList.emails);
  });

  // Socket.IO connection handling
  io.on('connection', (socket) => {
    console.log('conn', socket.id);

    // join event includes {email, usernameRequested}
    socket.on('join', (payload, cb) => {
      try {
        const email = (payload.email || '').toLowerCase();
        let usernameReq = (payload.username || '').trim() || null;

        // Check ban
        if (bans[email]) {
          cb && cb({ ok: false, reason: 'banned', ban: bans[email] });
          return;
        }

        // If user exists, preserve username & role. If new, create and set role
        let user = usersByEmail[email];
        if (!user) {
          // choose role
          let role = 'user';
          if (email === OWNER_EMAIL.toLowerCase()) role = 'owner';
          if (adminList.emails.map((e: string) => e.toLowerCase()).includes(email)) role = 'admin';
          const username = usernameReq || ('user' + Math.floor(Math.random() * 9000 + 1000));
          user = { username, email, role };
          usersByEmail[email] = user;
          saveAll();
        }

        // attach to socket
        (socket as any).data.user = user;

        // Send any unacknowledged warnings
        const userWarnings = warnings[email] || [];
        const unacked = userWarnings.filter((w: any) => !w.acknowledged);
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

      // Ensure user has acknowledged warnings? We block sending if there's unacked warnings
      const unacked = (warnings[user.email] || []).some((w: any) => !w.acknowledged);
      if (unacked) return cb && cb({ ok: false, err: 'warning' });

      const room = payload.room || 'General';
      const text = String(payload.text || '').trim();
      if (!text) return cb && cb({ ok: false, err: 'empty' });

      const display = (user.role === 'owner') ? 'OWNER' : (user.role === 'admin') ? 'ADMIN' : user.username;
      const msg = { display, text, email: user.email, role: user.role, ts: Date.now() };

      if (!messages[room]) messages[room] = [];
      messages[room].push(msg);
      messageLogs.push(Object.assign({ room }, msg));

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
      cb && cb({ ok: true, logs: messageLogs.slice().reverse().slice(0, 500) });
    });

    socket.on('getBans', (cb) => {
      const user = (socket as any).data.user;
      if (!user || (user.role !== 'admin' && user.role !== 'owner')) return cb && cb({ ok: false, err: 'no-perm' });
      cb && cb({ ok: true, bans });
    });

    socket.on('disconnect', () => {
      // nothing special for now
    });
  });

  return httpServer;
}
