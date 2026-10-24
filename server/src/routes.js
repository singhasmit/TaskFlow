const express = require("express");
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const auth = require("./controllers/authController");
const jobs = require("./controllers/jobController");
const { requireAuth } = require("./auth");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait and try again." },
});
const credentials = [
  body("email").isEmail().withMessage("A valid email is required"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters"),
];
const jobInput = [
  body("type")
    .isIn(["email", "report"])
    .withMessage("type must be email or report"),
  body("payload").isObject().withMessage("payload must be an object"),
  body("priority").optional().isInt({ min: 1, max: 10 }),
  body("attempts").optional().isInt({ min: 1, max: 5 }),
  body("scheduledAt")
    .optional()
    .isISO8601()
    .toDate()
    .custom((value) => {
      if (value <= new Date())
        throw new Error("scheduledAt must be in the future");
      if (value > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
        throw new Error("scheduledAt cannot be more than 30 days away");
      return true;
    }),
];

router.post(
  "/auth/register",
  authLimiter,
  [
    body("name")
      .trim()
      .isLength({ min: 2, max: 80 })
      .withMessage("Name must be 2-80 characters"),
    ...credentials,
  ],
  auth.register,
);
router.post("/auth/login", authLimiter, credentials, auth.login);
router.use(requireAuth);
router.post("/jobs", jobInput, jobs.submit);
router.get("/jobs", jobs.list);
router.get("/jobs/stats", jobs.stats);
router.get("/jobs/dashboard", jobs.dashboard);
router.get("/jobs/:id", jobs.detail);
router.post("/jobs/:id/cancel", jobs.cancel);
router.post("/jobs/:id/retry", jobs.retry);
router.post("/jobs/recover-pending", jobs.recover);

module.exports = router;
