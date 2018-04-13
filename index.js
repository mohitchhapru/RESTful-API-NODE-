const sqlite = require('sqlite'),
  Sequelize = require('sequelize'),
  request = require('request'),
  dotenv = require('dotenv'),
  express = require('express'),
  app = express();

const { PORT = 3333, NODE_ENV = 'test', DB_PATH = './db/database.db' } = process.env;
const ERR_MESSAGE = '"message" key missing';

const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASSWORD, {
  host: process.env.DB_HOST,
  dialect: 'sqlite',
  storage: './db/database.db'
});

sequelize
  .authenticate()
  .then(() => {
    console.log('\n sequelize: Established Connection successfully');
  })
  .catch(err => {
    console.error('\n sequelize: Error - Issue in connecting database :', err);
  });

// Importing models 
const Film = sequelize.import('./models/films');
const Genre = sequelize.import('./models/genres');

// START SERVER
Promise.resolve()
  .then(() => app.listen(PORT, () => console.log(`App listening on port ${PORT}`)))
  .catch((err) => {
    if (NODE_ENV === 'development')
      console.error(err.stack);
  });

// ROUTES
app.get('/films/:id/recommendations', getFilmRecommendations);

// Validation for Missing Route 
app.get('*', function (req, res) {
  res.status(404).json({
    message: ERR_MESSAGE
  })
});

// ROUTE HANDLER
function getFilmRecommendations(req, res) {
  let limit = 10, offset = 0;

  if (!Number.isInteger(parseInt(req.params.id, 10))) {
    res.status(422).json({
      message: ERR_MESSAGE
    });
  }

  if (req.query.limit) {
    if (!Number.isInteger(parseInt(req.query.limit, 10))) {
      res.status(422).json({
        message: ERR_MESSAGE
      });
    }
    limit = parseInt(req.query.limit, 10);
  }

  if (req.query.offset) {
    if (!Number.isInteger(parseInt(req.query.offset, 10))) {
      res.status(422).json({
        message: ERR_MESSAGE
      });
    }
    offset = parseInt(req.query.offset, 10);
  }

  Film.findById(req.params.id, {})
    .then(film => {
      Genre.findById(film.genre_id, {})
        .then(genre => {

          // Initializing Starting date as 15 years ago
          let startingData = new Date(film.release_date);
          startingData.setFullYear(startingData.getFullYear() - 15);

          // Initializing Ending date as 15 years later
          let endingDate = new Date(film.release_date);
          endingDate.setFullYear(endingDate.getFullYear() + 15);

          // Fetching all the films with same genere within the given date range
          Film.all({
            where: {
              genre_id: film.genre_id,
              release_date: {
                $between: [startingData, endingDate]
              }
            },
            order: ['id']
          })
            .then(films => {
              const flimIdSet = films.map(film => {
                return film.id
              });
              const FILM_IDS = flimIdSet.join(',');

              // Fetching reviews of all filtered film id's
              request(`http://credentials-api.generalassemb.ly/4576f55f-c427-4cfc-a11c-5bfe914ca6c1?films=${FILM_IDS}`, (err, response, body) => {
                const reviewsOfFilms = JSON.parse(body);
                const filmsReviewsOverFive = reviewsOfFilms.filter(listOfFilm => {
                  return listOfFilm.reviews.length >= 5;
                });

                // Mapping average rating of flims over 5 reviews
                const averageRatingOfFlimsOverFiveReviews = filmsReviewsOverFive.map(listOfFilm => {
                  const sumOfRating = listOfFilm.reviews.reduce((sum, val) => {
                    return sum + val.rating;
                  }, 0);
                  const averageFilmRaiting = sumOfRating / listOfFilm.reviews.length;
                  listOfFilm.average_rating = averageFilmRaiting;
                  return listOfFilm;
                });

                // Filtering films which are haveing above 4 as their average rating
                const filmsAboveFourRaiting = averageRatingOfFlimsOverFiveReviews.filter(listOfFilm => {
                  return listOfFilm.average_rating > 4;
                });

                // mapping top 10 films with rating above 4
                const filmIdsAboveFourRaiting = filmsAboveFourRaiting.map(film => {
                  return film.film_id;
                }).sort().slice(0, 10);

                // Rounding the decimal number to 2 if required              
                function roundToTwo(num) {    
                  return +(Math.round(num + "e+2")  + "e-2");
                }

                // Creating a final JSON string to return the recommended films 
                Film.all({
                  attributes: ['id', 'title', 'release_date'],
                  where: { 'id': { in: filmIdsAboveFourRaiting } },
                  order: ['id']
                })
                  .then(recommendedFilms => {
                    const recommendedFilmsAboveFourRating = recommendedFilms.map(film => {
                      const filmDetailsAboveFourRaiting = filmsAboveFourRaiting.filter(element => {
                        return element.film_id == film.id;
                      });

                      return {
                        id: filmDetailsAboveFourRaiting[0].film_id,
                        title: film.title,
                        releaseDate: film.release_date,
                        genre: genre.name,
                        averageRating: roundToTwo(filmDetailsAboveFourRaiting[0].average_rating),
                        reviews: filmDetailsAboveFourRaiting[0].reviews.length
                      }
                    });

                    res.json({
                      recommendations: recommendedFilmsAboveFourRating,
                      meta: {
                        limit: limit,
                        offset: offset
                      }
                    });
                  })
                  .catch(err => {
                    res.status(500).json(err);
                  });
              });
            })
            .catch(err => {
              res.status(500).json(err);
            });
        })
        .catch(err => {
          res.status(500).json(err);
        });
    })
    .catch(err => {
      res.status(500).json(err);
    });
}
module.exports = app;