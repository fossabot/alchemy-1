/**
 * The Http Conduit Class
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {IncomingMessage}   req
 * @param    {ServerResponse}    res
 * @param    {Router}            router
 */
var HttpConduit = Function.inherits('Conduit', function HttpConduit(req, res, router) {

	// Initialize basic conduit values
	HttpConduit.super.call(this);

	if (req != null) {
		// Make conduit available in req
		req.conduit = this;

		// Basic HTTP objects
		this.request = req;

		// The HTTP request headers
		this.headers = req.headers;

		// The path as given to us by the browser (including query)
		this.originalPath = req.url;

		// Is this an AJAX request?
		this.ajax = null;
	}

	if (res != null) {
		this.response = res;
	}

	if (router) {
		this.router = router;
	}

	// The HTTP status
	this.status = 200;

	this.debugMark('Parse request');

	// Parse the request, get the correct routes and such
	this.parseRequest();

	this.debugMark(false);

	// Call the middleware, which will call the handler afterwards
	this.callMiddleware();
});

/**
 * Return the IP address
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Conduit.setProperty(function ip() {

	var req = this.request;

	if (!req) {
		return null;
	}

	return req.headers['x-forwarded-for'] ||
	       req.connection.remoteAddress ||
	       req.socket.remoteAddress ||
	       req.connection.socket.remoteAddress;
});