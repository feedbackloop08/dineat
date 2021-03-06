require("dotenv").config();
const express = require("express");
const { pool, bcrypt } = require("../auth");
const jwt = require("jsonwebtoken");
const eateryRouter = express.Router();

eateryRouter.post("/gate", async (req, res, next) => {
  try {
    const user = await pool.query("Select password, name from restaurant where id = $1", [
      req.body.username,
    ]);
    if (!user.rowCount) {
      return res.status(401).json({ field: "idErr", msg: "Invalid ID" });
    } else {
      bcrypt.compare(req.body.password, user.rows[0].password, (err, same) => {
        if (same) {
          const entryPass = jwt.sign(
            { id: req.body.username, username: user.rows[0].name },
            process.env.LOB,
            { expiresIn: "18000000" }
          );
          res.cookie("Dineat", entryPass, {
            expiresIn: new Date(Date.now() + 18000000),
            maxAge: 18000000,
          });
          return res.json({ matched: true });
        } else {
          return res.status(401).json({ field: "passErr", msg: "Invalid password" });
        }
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ field: "passErr", msg: "Internal Server Error :/" });
  }
});

eateryRouter.post("/sanction", (req, res, next) => {
  jwt.verify(req.cookies["Dineat"], process.env.LOB, (err, payload) => {
    if (!err && payload.id) {
      return pool
        .query("Update bookings set uid = $1 where uid = $2", [req.body.status, req.body.token])
        .then((data) =>
          data.rowCount
            ? res.json({
                success: true,
                msg: `User ${req.body.status === "used" ? "Accepted" : "Rejected"}!`,
              })
            : res.json({ msg: "Problem with the request" })
        )
        .catch((err) => {
          console.log(err);
          return res.status(500).json({ msg: "Internal Server Error :/" });
        });
    } else {
      return res.status(401).json({ msg: "Invalid Request" });
    }
  });
});
eateryRouter.post("/verify", (req, res, next) => {
  jwt.verify(req.cookies["Dineat"], process.env.LOB, async (err, payload) => {
    if (!err && payload.id) {
      const query = await pool.query(
        "Select username, name, date, time, guests from bookings where uid = $1 and resid = $2",
        [req.body.ticket, payload.id]
      );
      if (query.rowCount) {
        const verifyTime = checkDateTime(query.rows[0].date, query.rows[0].time);
        if (verifyTime.notToday) {
          if (verifyTime.expired) {
            await pool.query("Update bookings set uid = $1 where uid = $2", [
              "expired",
              req.body.ticket,
            ]);
          }
          return res.json({
            color: "error",
            icon: "mdi-alert",
            success: false,
            msg: "Ticket invalid for today!",
          });
        }
        if (verifyTime.onTime) {
          await pool.query("Update bookings set uid = $1 where uid = $2", [
            "used",
            req.body.ticket,
          ]);
          return res.json({
            icon: "mdi-check-circle",
            color: "success",
            success: true,
            msg: "Verified",
            ...query.rows[0],
          });
        } else {
          return res.json({
            icon: "mdi-information",
            color: "orange",
            success: true,
            diff: true,
            msg: verifyTime.status,
            ...query.rows[0],
          });
        }
      } else {
        return res.json({
          icon: "mdi-alert",
          color: "error",
          success: false,
          msg: "Invalid QR Code",
        });
      }
    } else {
      return res.status(401).json({ msg: "Invalid Request" });
    }
  });
});

const checkDateTime = (date, time) => {
  if (!new Date().toISOString().includes(date)) {
    if (new Date(date).getTime() < Date.now()) {
      return { notToday: true, expired: true };
    }
    return { notToday: true };
  }

  const current = new Date(date);
  const [hrs, mins] = time.split(":");
  const setTime = new Date(current.setHours(hrs)).setMinutes(mins);

  if (Math.abs(setTime - Date.now()) <= 900000) {
    return { onTime: true };
  } else if (Date.now() - setTime > 900000) {
    return { onTime: false, status: "Late for the reservation!" };
  } else if (setTime - Date.now() > 900000) {
    return { onTime: false, status: "Early for the reservation!" };
  }
};
module.exports = eateryRouter;
