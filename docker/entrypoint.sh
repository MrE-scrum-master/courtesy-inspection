#!/bin/sh
set -e

echo "Starting Courtesy Inspection API server..."

# Wait for database to be ready
echo "Waiting for database connection..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if node -e "
        const { Pool } = require('pg');
        const pool = new Pool({ connectionString: process.env.DATABASE_URL });
        pool.query('SELECT 1')
            .then(() => { console.log('Database connected'); process.exit(0); })
            .catch(() => { console.log('Database not ready, retrying...'); process.exit(1); });
    "; then
        echo "Database is ready!"
        break
    fi
    
    attempt=$((attempt + 1))
    echo "Database connection attempt $attempt/$max_attempts failed. Retrying in 2 seconds..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "Failed to connect to database after $max_attempts attempts"
    exit 1
fi

# Run database migrations
echo "Running database migrations..."
npm run db:migrate

# Start the server
echo "Starting server on port $PORT..."
exec node dist/server.js