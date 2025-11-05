import { publicConfig } from "../lib/config.js";

export const getPublicConfig = async (req, res) => {
  // No auth required; values are safe for client-side validation/use
  res.status(200).json(publicConfig);
};