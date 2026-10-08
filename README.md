# Resume API

A small resume API project built to demonstrate authentication, caching, rate limiting, database usage, and API performance under load.

## Stack

- React + Vite + TypeScript
- Node.js + Fastify + TypeScript
- PostgreSQL
- Drizzle ORM
- Redis
- JWT
- Nodemailer
- Playwright
- Docker

## Architecture

React
  |
  v
Fastify API
  |
  +-- Redis
  |
  +-- PostgreSQL

Playwright
  |
  v
API load testing

## Features

- Email OTP login
- JWT authentication
- Rate limiting
- Redis OTP storage
- Redis resume caching
- PostgreSQL user storage
- Authenticated resume download
- Playwright load testing

## Run infrastructure

```bash
docker compose up -d