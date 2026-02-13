//Query refers to the MongoQuery that will be created using the express's queryString
class APIFeatures {
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
  }

  //Filter - Remove the non-data based filters like sort, limit, page and fields.
  filter() {
    //create new object with only the data based filters.
    const queryObj = { ...this.queryString };
    const excludedFieds = ["page", "limit", "sort", "fields"];
    excludedFieds.forEach((element) => delete queryObj[element]);

    //Chain the find method on the Mongo Query, before that convert the operators to Mongo Operator $. gte -> $gte
    let queryStr = JSON.stringify(queryObj);
    queryStr = queryStr.replace(/\b(lte|gte|gt|lt)\b/g, (match) => `$${match}`);
    this.query.find(JSON.parse(queryStr)); //Chaining

    //return the current object
    return this;
  }

  sort() {
    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.query = this.query.sort(sortBy + " id");
    } else {
      this.query = this.query.sort("id");
    }
    return this;
  }

  limitFields() {
    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");

      this.query = this.query.select(fields);
    }
    return this;
  }

  pagination() {
    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 100;
    const skip = (page - 1) * limit;

    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
