const asyncHandler = require('../utils/asyncHandler');

function createAuthController(service) {
  return {
    login: asyncHandler(async (req, res) => {
      const { correo, contrasena } = req.body || {};
      res.json(await service.login(correo, contrasena));
    }),
    requestPasswordReset: asyncHandler(async (req, res) => {
      const { correo } = req.body || {};
      res.json(await service.requestPasswordReset(correo));
    }),
    resetPassword: asyncHandler(async (req, res) => {
      const { token, contrasena } = req.body || {};
      res.json(await service.resetPassword(token, contrasena));
    })
  };
}

module.exports = createAuthController;
