const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "covid19IndiaPortal.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const convertDbObjectToResponseObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};

const convertDbObjectToResponseObject2 = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", (request, response) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.send("Invalid JWT Token");
      } else {
        const getBooksQuery = `
            SELECT
              *
            FROM
             state`;
        const booksArray = await database.all(getBooksQuery);
        response.send(
          booksArray.map((eachPlayer) =>
            convertDbObjectToResponseObject(eachPlayer)
          )
        );
      }
    });
  }
});

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  let { stateId } = request.params;
  const selectUserQuery = `SELECT * FROM state WHERE state_id = '${stateId}'`;
  const userDetails = await database.get(selectUserQuery);
  response.send(convertDbObjectToResponseObject(userDetails));
});

app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    let { stateId } = request.params;
    const selectUserQuery = `SELECT sum(cases) AS "totalCases", sum(cured) AS "totalCured", sum(active) AS "totalActive", sum(deaths) AS "totalDeaths" FROM district WHERE state_id = '${stateId}'`;
    const userDetails = await database.get(selectUserQuery);
    response.send(userDetails);
  }
);

app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    const selectUserQuery = `SELECT * FROM district WHERE district_id = '${districtId}'`;
    const userDetails = await database.get(selectUserQuery);
    response.send(convertDbObjectToResponseObject2(userDetails));
  }
);

app.post("/districts/", authenticateToken, async (request, response) => {
  let { districtName, stateId, cases, cured, active, deaths } = request.body;
  const selectUserQuery = `INSERT INTO district(district_name, state_id, cases, cured, active, deaths) VALUES ('${districtName}','${stateId}', '${cases}','${cured}','${active}','${deaths}')`;
  const userDetails = await database.run(selectUserQuery);
  response.send("District Successfully Added");
  console.log(userDetails);
});

app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    let { districtName, stateId, cases, cured, active, deaths } = request.body;
    const selectUserQuery = `UPDATE district SET district_name = '${districtName}', state_id = '${stateId}', cases = '${cases}', cured = '${cured}', active = '${active}', deaths = '${deaths}' WHERE district_id = '${districtId}'`;
    const userDetails = await database.run(selectUserQuery);
    response.send("District Details Updated");
  }
);

app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    let { districtId } = request.params;
    const selectUserQuery = `DELETE FROM district WHERE district_id = '${districtId}'`;
    const userDetails = await database.run(selectUserQuery);
    response.send("District Removed");
  }
);

module.exports = app;
