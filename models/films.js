module.exports = function (sequelize, DataTypes) {
  return sequelize.define('film', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true    
    },
    title: {
      type: DataTypes.STRING
    },
    release_date: {
      type: DataTypes.DATEONLY
    },
    tagline: {
      type: DataTypes.STRING
    },
    revenue: {
      type: DataTypes.INTEGER
    },
    budget: {
      type: DataTypes.INTEGER
    },
    runtime: {
      type: DataTypes.INTEGER
    },
    original_language: {
      type: DataTypes.STRING
    },
    status: {
      type: DataTypes.STRING
    },
    genre_id: {
      type: DataTypes.INTEGER
    }
  }, {
      underscored: true,
      timestamps: false
    });
}