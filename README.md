# Kenaz Community Platform

A full-stack community event management platform built with React and FastAPI, enabling users to discover, register, and participate in local community events.

## Features

- 🎫 **Event Management** - Browse, filter, and register for community events
- 🌍 **Multi-City Support** - Filter events by city and location
- 👤 **User Profiles** - Personalized profiles with interests and preferences
- 🔐 **OAuth Authentication** - Secure login with Google OAuth and password-based auth
- 💳 **Payment Integration** - Subscription management and event payment processing
- 📱 **Responsive Design** - Mobile-friendly interface built with Tailwind CSS
- 🔔 **Real-time Notifications** - Stay updated on event changes and registrations
- 👥 **Admin Panel** - Comprehensive event and user management tools

## Tech Stack

### Frontend
- **React 18** - Modern UI library
- **Vite** - Fast build tool and dev server
- **React Router** - Client-side routing
- **Tailwind CSS** - Utility-first CSS framework
- **PWA Support** - Progressive Web App capabilities

### Backend
- **FastAPI** - High-performance Python web framework
- **PostgreSQL** - Robust relational database
- **SQLAlchemy** - ORM with async support
- **Alembic** - Database migrations
- **OAuth 2.0** - Google authentication
- **JWT** - Secure token-based authentication

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL 14+
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/centrumkenaz.com.git
   cd centrumkenaz.com
   ```

2. **Backend Setup**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure Environment**
   ```bash
   cp backend/.env.example backend/.env
   # Edit backend/.env with your database and OAuth credentials
   ```

4. **Database Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

5. **Frontend Setup**
   ```bash
   npm install
   ```

### Running the Application

#### Development Mode

Start both frontend and backend:
```bash
./start.sh
```

Or run separately:

**Backend:**
```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

**Frontend:**
```bash
npm run dev
```

#### Production Mode

Build and serve:
```bash
npm run build
# Backend runs with production WSGI server
```

### Stopping the Application

```bash
./stop.sh
```

## Project Structure

```
.
├── backend/                # FastAPI backend
│   ├── models/            # SQLAlchemy models
│   ├── routers/           # API endpoints
│   ├── services/          # Business logic
│   ├── security/          # Auth and rate limiting
│   ├── adapters/          # Payment gateway adapters
│   ├── tests/             # Backend tests
│   └── alembic/           # Database migrations
├── src/                   # React frontend
│   ├── components/        # Reusable UI components
│   ├── pages/             # Page components
│   ├── api/               # API client functions
│   ├── context/           # React context providers
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
├── docs/                  # Documentation
└── scripts/               # Deployment scripts
```

## API Documentation

Once running, visit:
- **Interactive API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc

## Testing

### Backend Tests
```bash
cd backend
pytest
pytest --cov=. --cov-report=html  # With coverage report
```

### Frontend Tests
```bash
npm test
```

## Configuration

### Environment Variables

Key environment variables for `backend/.env`:

```env
# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/kenaz

# Auth
SECRET_KEY=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Frontend
FRONTEND_URL=http://localhost:5173

# Payment Gateway (Optional)
TPAY_API_KEY=your-tpay-key
```

## Deployment

### Automated CI/CD

This project uses GitHub Actions for continuous deployment. Every push to `main` automatically deploys to production.

**Setup:** Configure GitHub Secrets (SSH_HOST, SSH_USER, SSH_PRIVATE_KEY)  
**Documentation:** See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete setup guide

### Manual Deployment

```bash
./scripts/deploy_lightsail.sh  # Quick deploy
./scripts/release_lightsail.sh # Full release with tests
```

For detailed deployment instructions, troubleshooting, and server setup, see **[DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Security

For security concerns, please review [SECURITY.md](backend/SECURITY.md) and report vulnerabilities responsibly.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Authors

- **Tomasz Plescikowski** - *Initial work*

## Acknowledgments

- Built with modern web technologies
- Inspired by community-driven event platforms
- Special thanks to all contributors

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Contact: support@centrumkenaz.com

---

**Made with ❤️ for community building**
