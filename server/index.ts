import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Environment variable validation and defaults
function validateEnvironment() {
  const requiredEnvVars = ['SESSION_SECRET'];
  const missing = [];
  
  // Set NODE_ENV to production if not set for deployment
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'production';
  }
  
  // Check for SESSION_SECRET and provide a fallback
  if (!process.env.SESSION_SECRET) {
    // Generate a random session secret if not provided
    const crypto = require('crypto');
    process.env.SESSION_SECRET = crypto.randomBytes(64).toString('hex');
    console.warn('⚠️  SESSION_SECRET not provided, using auto-generated secret (not recommended for production)');
  }
  
  // Log environment info
  console.log(`🔧 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔑 SESSION_SECRET: ${process.env.SESSION_SECRET ? 'configured' : 'missing'}`);
  
  return true;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Main server initialization with comprehensive error handling
async function startServer() {
  try {
    // Validate environment variables first
    validateEnvironment();
    
    console.log('🚀 Starting MiniChat server...');
    
    const server = await registerRoutes(app);

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";
      
      console.error('Express error:', err);
      res.status(status).json({ message });
      
      // Don't throw the error to prevent server crash
      return;
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log('🔧 Setting up Vite for development...');
      await setupVite(app, server);
    } else {
      console.log('📦 Serving static files for production...');
      serveStatic(app);
    }

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    // Wrap server.listen in promise for better error handling
    await new Promise<void>((resolve, reject) => {
      server.listen({
        port,
        host: "0.0.0.0",
        reusePort: true,
      }, (err?: Error) => {
        if (err) {
          reject(err);
          return;
        }
        
        log(`serving on port ${port}`);
        
        // Display public URL for Replit
        const replitUrl = process.env.REPLIT_URL;
        const replOwner = process.env.REPL_OWNER;
        const replSlug = process.env.REPL_SLUG;
        
        if (replitUrl) {
          console.log(`\n🌐 Public URL: ${replitUrl}`);
        } else if (replOwner && replSlug) {
          console.log(`\n🌐 Public URL: https://${replSlug}.${replOwner}.repl.co`);
        } else {
          console.log(`\n🌐 Server running locally on port ${port}`);
          console.log(`   Local URL: http://localhost:${port}`);
        }
        console.log(`\n✅ MiniChat application is ready!\n`);
        resolve();
      });
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available');
    
    // Graceful shutdown
    console.log('🔄 Attempting graceful shutdown...');
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.log('🔄 Attempting graceful shutdown due to unhandled rejection...');
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  console.log('🔄 Attempting graceful shutdown due to uncaught exception...');
  process.exit(1);
});

// Start the server
startServer();
