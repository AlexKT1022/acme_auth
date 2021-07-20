const Sequelize = require('sequelize');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { STRING } = Sequelize;
const config = {
  logging: false,
};

if (process.env.LOGGING) {
  delete config.logging;
}
const conn = new Sequelize(
  process.env.DATABASE_URL || 'postgres://localhost/acme_db',
  config
);

const User = conn.define('user', {
  username: STRING,
  password: STRING,
});

User.byToken = async (token) => {
  try {
    const data = jwt.verify(token, process.env.JWT);
    const user = await User.findByPk(data.userId);

    if (user) {
      return user;
    }

    const error = Error('bad credentials');

    error.status = 401;
    throw error;
  } catch (ex) {
    const error = Error('bad credentials');
    error.status = 401;
    throw error;
  }
};

User.authenticate = async ({ username, password }) => {
  const user = await User.findOne({
    where: {
      username,
    },
  });

  if (user && (await bcrypt.compare(password, user.password))) {
    return jwt.sign({ userId: user.id }, process.env.JWT);
  }

  const error = Error('bad credentials');
  error.status = 401;
  throw error;
};

User.beforeCreate(async (user, options) => {
  const hashedPassword = await bcrypt.hash(user.password, 10);

  user.password = hashedPassword;
});

const Note = conn.define('note', {
  text: STRING,
});

User.hasMany(Note);

Note.belongsTo(User);

const syncAndSeed = async () => {
  await conn.sync({ force: true });
  const credentials = [
    { username: 'lucy', password: 'lucy_pw' },
    { username: 'moe', password: 'moe_pw' },
    { username: 'larry', password: 'larry_pw' },
  ];
  const notes = [
    { text: 'getting started' },
    { text: 'json web tokens' },
    { text: 'bcrypt' },
    { text: 'user notes' },
    { text: 'done' },
  ];
  const [lucy, moe, larry] = await Promise.all(
    credentials.map((credential) => User.create(credential))
  );
  const [note1, note2, note3, note4, note5] = await Promise.all(
    notes.map((note) => Note.create(note))
  );

  await lucy.setNotes([note1, note5]);
  await moe.setNotes([note2, note4]);
  await larry.setNotes([note3]);

  return {
    users: {
      lucy,
      moe,
      larry,
    },
    notes: {
      note1,
      note2,
      note3,
      note4,
      note5,
    },
  };
};

module.exports = {
  syncAndSeed,
  models: {
    User,
    Note,
  },
};
