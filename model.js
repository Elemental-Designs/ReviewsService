const db = require('./db.js');

module.exports = {
  get: function({page,count,sort,product_id},callback){
   // console.log(sort);
    if(sort ==='newest') sort = 'order by r.date desc';
    if(sort ==='helpful') sort = 'order by r.helpfulness desc';
    if(sort === 'relevant') sort = 'order by r.helpfulness desc, r.date desc';//sort
 //${sort} => order by ${sort} DESC
    const queryString = `
    SELECT r.id as review_id, r.rating,r.summary,r.recommend,r.response,r.body,r.date,r.reviewer_name,r.helpfulness,
    (SELECT COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id',id,'url',url)),'[]')
      FROM photos
      WHERE review_id = r.id) AS photos
    FROM reviews as r
    WHERE  product_id = ${product_id}
    AND reported = FALSE
    ${sort}
    LIMIT ${count}
    OFFSET ${count*(page-1)}
    `;
    db.query(queryString,(err,data)=>{
      console.log(err);
      if(err){
        console.log('Err during get reviews in db');
      }
      else{
        callback(err, {
          product_id:product_id,
          page:page,
          count:count,
          result:data.rows.map(r => {return {...r, ...{date: (new Date(parseInt(r.date))).toLocaleDateString()}}})
        })
      }
    })
  },

  getMetaData: function(id,callback){
  // const data = {};
  // data.product_id=id;
  // data.rating=
  //  queryArray.push(db.query(`SELECT rating, COUNT(*) as rateCount FROM reviews WHERE product_id = ${id} GROUP BY rating`));

  //   queryArray.push(db.query(`SELECT recommend, COUNT(*) as recommendCount FROM reviews  WHERE product_id = ${id} GROUP BY recommend`));

  //   queryArray.push(db.query(`SELECT c.name, AVG(cr.value) as avg_score
  //    FROM characteristic_reviews cr
  //    INNER JOIN characteristics c
  //    ON c.id = cr.characteristic_id
  //    WHERE c.product_id  = ${id}
  //    GROUP BY c.name
  //   `));
  //   return Promise.all(queryArray)
  //   .then(()=>callback({}))
  //   .catch((err)=>callback(err));

    db.query(`
    SELECT
      ${id} AS product_id,
      (SELECT JSON_OBJECT_AGG(rating, rateCount)
          FROM (SELECT rating, COUNT(*) AS rateCount
          FROM reviews
          WHERE product_id = ${id}
          GROUP BY rating ) AS x
      ) AS ratings,
      (SELECT JSON_OBJECT_AGG(recommend, recCount)
          FROM (SELECT recommend, COUNT(*) AS recCount
          FROM reviews
          WHERE product_id = ${id}
          GROUP BY recommend ) AS x
      ) AS recommended,
      (SELECT JSON_OBJECT_AGG(name, JSON_BUILD_OBJECT('id', characteristic_id, 'value', avgVal))
        FROM(SELECT name,characteristic_id, AVG(value) AS avgVal
        FROM characteristic_reviews
        INNER JOIN characteristics c ON c.id=characteristic_reviews.characteristic_id
        WHERE product_id = ${id}
        GROUP BY name,characteristic_id) AS x
      ) AS characteristics
    `, (err, data) => {
      if (err) {
        console.log(err)
      } else {
        console.log("get meta :",data.rows);
        callback(err, data.rows)
      }
    })
  },

  putHelpful: function(reviewId,callback){
   // console.log('test: ',reviewId);
    db.query(`
    UPDATE reviews
    SET helpfulness = helpfulness + 1
    WHERE id = ${reviewId}
     `,
      (err) => {
        callback(err)
        console.log(err)
      }
    )
  },

  putReport:function(reviewId,callback){
    db.query(`
    UPDATE reviews
    SET reported = true
    WHERE id = ${reviewId}
     `,
     (err) => {
        callback(err);
    })
  },

  postReview: async function(req){
  const date = Date.now();
    const queryArray = [];
  const reviewQuery = `
  INSERT INTO reviews (
    product_id,
    rating,
    date,
    summary,
    body,
    recommend,
    reviewer_name,
    reviewer_email,
    response
  )
  VALUES (
    $1,
    $2,
    $3,
    $4,
    $5,
    $6,
    $7,
    $8,
    $9
  )
  RETURNING id
  ;`;
  const result = await db.query(reviewQuery, [
    req.body.product_id,
    req.body.rating,
    date,
    req.body.summary,
    req.body.body,
    req.body.recommend,
    req.body.name,
    req.body.email,
    ""
  ])
  //console.log(result.rows);//[ { id: 5775015 } ]
  const reviewID = result.rows[0].id;
  if (req.body.photos.length) {
    req.body.photos.forEach((url) => {
      queryArray.push(db.query(`
      INSERT INTO photos (
        review_id,
        url
      )
      VALUES (
        $1,
        $2
      )
      ;`, [reviewID, url]));
    });
  }
  const chars = req.body.characteristics;
  // {
  //   Size: { id: 14, value: 5 },
  //   Width: { id: 15, value: 4 },
  //   Comfort: { id: 16, value: 3 },
  //   Quality: { id: 17, value: 4 }
  // }
 // console.log("Object1 :", Object.keys(chars));
//Object1 : [ 'Size', 'Width', 'Comfort', 'Quality' ]
  if (Object.keys(chars).length) {
    Object.keys(chars).forEach((char) => {
      queryArray.push(db.query(`
      INSERT INTO characteristic_reviews (
        characteristic_id,
        review_id,
        value
      ) VALUES (
        $1,
        $2,
        $3
      )
      ;`,[char.id, reviewID, char.value]));
    });
  }

  return Promise.all(queryArray)
     .then(() => {
      console.log('review added!')})
 }
};
