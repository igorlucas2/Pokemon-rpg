const express = require("express");
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect("/login");
  next();
}

router.get("/", requireAuth, (req, res) => {
  res.render("pokedex", { user: req.session.user });
});

module.exports = router;
