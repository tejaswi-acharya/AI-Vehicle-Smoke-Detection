module.exports = (err, req, res, next) => {
  if (err.name === "ValidationError") {
    return res.status(400).json({ message: "Invalid data", errors: err.errors });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid ID" });
  }
  console.error(err);
  res.status(500).json({ message: "Server error" });
};
