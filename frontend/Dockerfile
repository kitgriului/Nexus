FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies with yarn (faster than npm)
RUN yarn install --network-timeout 100000

# Copy application code
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run dev server
CMD ["yarn", "dev", "--host"]
