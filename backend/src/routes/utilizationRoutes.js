const express = require("express"); // web framework
const router = express.Router(); // mini router for this module
const auth = require("../middleware/auth"); // verifies JWT, sets req.user
const roleCheck = require("../middleware/roleCheck"); // checks req.user.role matches allowed roles
const orgIsolation = require("../middleware/orgIsolation"); // forces req.orgId from JWT, strips client orgId

const {
    addUtilization,
    listUtilization,
    updateStatus,
} = require("../controllers/utilizationController");

router.use(auth, roleCheck("ADMIN"), orgIsolation);

router.post("/", addUtilization);
router.get("/", listUtilization);
router.put("/:id", updateStatus);

module.exports = router;