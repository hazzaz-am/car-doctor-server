require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

// middlewares
const app = express();
app.use([
	cors({
		origin: [
			"http://localhost:5173",
			"https://car-shop-47788.web.app",
			"https://car-shop-47788.firebaseapp.com",
		],
		credentials: true,
	}),
	express.json(),
]);
app.use(cookieParser());

const logger = (req, res, next) => {
	console.log("LOG INFO: ", req.method, req.url);
	next();
};

const verifyToken = (req, res, next) => {
	const token = req?.cookies?.token;
	// console.log("token in the middleware", token);
	if (!token) {
		return res.status(401).send({ message: "Unauthorized Access" });
	}
	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res.status(401).send({ message: "Unauthorized Access" });
		}
		req.user = decoded;
		next();
	});
};
const port = process.env.PORT || 5000;

// health check
app.get("/", (_req, res) => {
	res.send({
		message: "Server is running",
	});
});

// mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.hrmc7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

const cookieOption = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production" ? true : false,
	sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
};

async function run() {
	try {
		// Connect the client to the server	(optional starting in v4.7)
		// await client.connect();
		const serviceCollection = client.db("carshopDB").collection("services");
		const bookingCollection = client.db("carshopDB").collection("bookings");

		// --------------------------------------------
		// AUTH RELATED APIS

		// SET COOKIE
		app.post("/jwt", logger, (req, res) => {
			const user = req.body;
			console.log("used for token", user);
			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: "1h",
			});
			res.cookie("token", token, cookieOption).json({ success: true });
		});

		// CLEAR COOKIE
		app.post("/logout", async (req, res) => {
			const user = req.body;
			console.log("logging out", user);
			res
				.clearCookie("token", { ...cookieOption, maxAge: 0 })
				.json({ success: true });
		});

		// --------------------------------------------
		// SERVICES APIS

		// get all services
		app.get("/services", async (req, res) => {
			const result = await serviceCollection.find().toArray();
			// console.log(result);
			res.send(result);
		});

		// get one service
		app.get("/services/:serviceId", async (req, res) => {
			const id = req.params.serviceId;
			const query = { _id: new ObjectId(id) };

			const result = await serviceCollection.findOne(query);
			console.log(result);
			res.send(result);
		});

		// insert new service
		app.post("/services", async (req, res) => {
			const service = req.body;
			const result = await serviceCollection.insertOne(service);
			res.send(result);
		});

		// --------------------------------------------
		// BOOKINGS APIS

		// insert new booking
		app.post("/bookings", async (req, res) => {
			const bookingInformation = req.body;
			const result = await bookingCollection.insertOne(bookingInformation);
			res.send(result);
		});

		// get bookings
		app.get("/bookings", logger, verifyToken, async (req, res) => {
			console.log("token owner info", req.user);
			// console.log("cookies", req.cookies);
			if (req?.user?.email !== req.query.email) {
				return res.status(403).send({ message: "Forbidden Access" });
			}
			// Query for bookings for specific user
			let query = {};
			if (req.query.email) {
				query = { email: req.query.email };
			}

			const result = await bookingCollection.find(query).toArray();
			// console.log(result);
			res.send(result);
		});

		// DELETE ONE SPECIFIC BOOKING INFORMATION
		app.delete("/bookings/:bookingId", async (req, res) => {
			const id = req.params.bookingId;
			const filter = { _id: new ObjectId(id) };
			const result = await bookingCollection.deleteOne(filter);
			// console.log(result);
			res.send(result);
		});

		// DELETE ALL ORDERS
		app.delete("/bookings", async (req, res) => {
			const result = await bookingCollection.deleteMany();
			res.send(result);
		});

		// UPDATE A ORDER
		app.put("/bookings/:bookId", async (req, res) => {
			const id = req.params.bookId;
			const booking = req.body;

			const updateBooking = {
				$set: {
					status: booking.status,
				},
			};
			const filter = { _id: new ObjectId(id) };

			const result = await bookingCollection.updateOne(filter, updateBooking);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		// await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// Ensures that the client will close when you finish/error
		// await client.close();
	}
}
run().catch(console.dir);

app.listen(port, () => {
	console.log(`app is listening on PORT: ${port}`);
});
