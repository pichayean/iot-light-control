# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY backend/package*.json ./

# Install dependencies
RUN npm install --production

# Copy backend files
COPY backend/ .

# Copy frontend files
COPY frontend ../frontend

# Expose the port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
