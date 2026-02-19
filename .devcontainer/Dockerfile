# Kenaz Development Container
# Multi-purpose container for IDE-agnostic development

FROM python:3.14-slim

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Core utilities
    curl \
    wget \
    git \
    ca-certificates \
    gnupg \
    lsof \
    procps \
    # Shell
    zsh \
    # Build tools
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20.x LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Oh My Zsh and plugins
RUN sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended \
    && git clone https://github.com/zsh-users/zsh-autosuggestions ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions \
    && git clone https://github.com/zsh-users/zsh-syntax-highlighting ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting

# Configure zsh with plugins and aliases
RUN sed -i 's/plugins=(git)/plugins=(git zsh-autosuggestions zsh-syntax-highlighting)/' ~/.zshrc \
    && echo '' >> ~/.zshrc \
    && echo '# Auto-activate Python venv if exists' >> ~/.zshrc \
    && echo 'if [ -d "/workspace/backend/venv" ]; then' >> ~/.zshrc \
    && echo '  source /workspace/backend/venv/bin/activate' >> ~/.zshrc \
    && echo 'fi' >> ~/.zshrc \
    && echo '' >> ~/.zshrc \
    && echo '# Kenaz aliases' >> ~/.zshrc \
    && echo 'alias start="./start.sh"' >> ~/.zshrc \
    && echo 'alias stop="./stop.sh"' >> ~/.zshrc \
    && echo 'alias logs-backend="tail -f logs/backend.log"' >> ~/.zshrc \
    && echo 'alias logs-frontend="tail -f logs/frontend.log"' >> ~/.zshrc \
    && echo 'alias logs="tail -f logs/*.log"' >> ~/.zshrc

# Set zsh as default shell
RUN chsh -s $(which zsh)

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code || echo "Claude Code CLI installation skipped"

# Install Gemini CLI (Google AI)
# Try multiple package names as Google's CLI naming varies
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || true && \
    npm install -g @google/generative-ai 2>/dev/null || true && \
    pip install --no-cache-dir google-generativeai || true

# Install Python development tools
RUN pip install --no-cache-dir \
    pip-tools \
    ipython \
    black \
    isort \
    flake8 \
    mypy \
    pytest \
    pytest-asyncio \
    pytest-cov

# Set working directory
WORKDIR /workspace

# Expose ports for frontend and backend
EXPOSE 5173 8000

# Default command - keep container running
CMD ["zsh"]
