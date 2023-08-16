// CREATE A COLLECTION WITH DEFAULT JSON SCHEMA
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'surname', 'password'],
      properties: {
        name: {
          bsonType: 'string',
          description: 'Name is required and must be string',
        },
        surname: {
          bsonType: 'string',
          description: 'Surname is required and must be string',
        },
        password: {
          bsonType: 'string',
          description: 'Password is required and must be string',
        },
      },
    },
  },
});

// SET OR UPDATE JSON SCHEMA OF A COLLECTION
db.runCommand({
  collMod: 'users',
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['username', 'name', 'surname'],
      properties: {
        username: {
          bsonType: 'string',
          description: 'Username is required and must be string',
        },
        name: {
          bsonType: 'string',
          description: 'Name is required and must be string',
        },
        surname: {
          bsonType: 'string',
          description: 'Surname is required and must be string',
        },
        password: {
          bsonType: 'string',
          description: 'Password is required and mut be string',
        },
      },
    },
  },
});
