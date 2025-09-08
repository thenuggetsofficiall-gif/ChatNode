# MiniChat - Real-time Chat Application

## Overview

MiniChat is a real-time chat application built with a modern web stack featuring a React frontend and Node.js backend with Socket.IO for real-time communication. The application provides a comprehensive chat experience with multiple rooms, user authentication, role-based permissions, and administrative features including user management, warnings, and bans.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

The frontend is built using React with TypeScript and follows a component-based architecture:

- **UI Framework**: React with TypeScript, utilizing modern hooks and functional components
- **Styling**: Tailwind CSS with a comprehensive design system using shadcn/ui components for consistent UI elements
- **State Management**: React Query (@tanstack/react-query) for server state management and local React state for UI state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time Communication**: Socket.IO client for bidirectional real-time communication
- **Form Handling**: React Hook Form with Zod validation schemas
- **Build Tool**: Vite for fast development and optimized production builds

The component structure separates concerns with dedicated components for authentication, chat interface, message display, sidebar navigation, and administrative functions.

### Backend Architecture

The backend implements a Express.js server with Socket.IO integration:

- **Server Framework**: Express.js with TypeScript for the HTTP server layer
- **Real-time Engine**: Socket.IO for WebSocket-based real-time communication
- **Data Storage**: File-based JSON storage for user data, messages, rooms, and administrative records
- **Authentication**: Simple email-based authentication with role-based access control
- **Session Management**: In-memory session handling through Socket.IO connections

The server architecture separates HTTP routes from Socket.IO event handlers, with a storage abstraction layer that currently uses in-memory storage but can be extended to use persistent databases.

### Data Storage Solutions

Currently implements a dual storage approach:

- **File-based Storage**: JSON files for persistent data including users, messages, rooms, warnings, and bans
- **In-memory Storage**: Runtime storage for active sessions and temporary data
- **Database Ready**: Drizzle ORM configuration present for PostgreSQL integration, indicating future database migration capability

The storage layer is abstracted through interfaces, making it easy to swap between different storage implementations.

### Authentication and Authorization

- **Simple Email-based Auth**: Users authenticate using email addresses with optional usernames
- **Role-based Permissions**: Three user roles (user, admin, owner) with escalating privileges
- **Administrative Controls**: Comprehensive moderation tools including warnings, bans, and message logging
- **Session Management**: Socket.IO-based session handling with connection state management

### Real-time Communication Features

- **Multi-room Support**: Users can create and join different chat rooms
- **Live Messaging**: Instant message delivery using Socket.IO
- **User Presence**: Connection status tracking and user management
- **Administrative Broadcasting**: Real-time notifications for warnings and bans
- **Message Logging**: Comprehensive audit trail for all chat activities

## External Dependencies

### Core Runtime Dependencies

- **@neondatabase/serverless**: PostgreSQL database connection (prepared for future use)
- **drizzle-orm**: Type-safe database ORM with PostgreSQL dialect
- **socket.io**: Real-time bidirectional event-based communication
- **express**: Web application framework for the server
- **cors**: Cross-origin resource sharing middleware

### Frontend UI and Interaction

- **@radix-ui**: Comprehensive set of accessible UI primitives for dialogs, dropdowns, navigation, and form controls
- **@tanstack/react-query**: Server state management and caching
- **class-variance-authority**: Utility for constructing conditional CSS classes
- **tailwindcss**: Utility-first CSS framework
- **react-hook-form**: Performant forms with easy validation
- **wouter**: Lightweight routing for React applications

### Development and Build Tools

- **vite**: Next-generation frontend build tool
- **typescript**: Static type checking
- **drizzle-kit**: Database migration and management tools
- **esbuild**: Fast JavaScript bundler for server-side builds

### Styling and Design System

- **shadcn/ui**: Pre-built component library built on Radix UI and Tailwind CSS
- **lucide-react**: Consistent icon library
- **date-fns**: Date utility library for message timestamps

The application is configured for deployment on Replit with specific development tooling and runtime error handling optimized for the platform.