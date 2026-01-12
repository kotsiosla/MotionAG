FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies (no lockfile to avoid conflicts)
RUN npm install --omit=dev

# Copy the script
COPY poll.js ./

# Run the polling service
CMD ["node", "poll.js"]
