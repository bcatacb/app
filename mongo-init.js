// MongoDB initialization script
// Creates database and initial collections with indexes

db = db.getSiblingDB('beat_analyzer_prod');

// Create users collection
db.createCollection('users');

// Create tracks collection
db.createCollection('tracks');

// Create indexes for users collection
db.users.createIndex({ "username": 1 }, { unique: true });
db.users.createIndex({ "email": 1 }, { unique: true });

// Create indexes for tracks collection
db.tracks.createIndex({ "user_id": 1 });
db.tracks.createIndex({ "id": 1 }, { unique: true });
db.tracks.createIndex({ "bpm": 1 });
db.tracks.createIndex({ "key": 1 });
db.tracks.createIndex({ "mood_tags": 1 });
db.tracks.createIndex({ "instruments.name": 1 });
db.tracks.createIndex({ "analyzed_at": 1 });

// Compound index for common searches
db.tracks.createIndex({ 
  "user_id": 1, 
  "bpm": 1, 
  "key": 1 
});

print('Database initialization completed successfully!');
