/**
 * The Alchemy helper
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.0.1
 * @version  1.0.0
 *
 * @param    {ViewRender}    view
 */
var Alchemy = Function.inherits('Alchemy.Helper', function Alchemy(view) {
	Alchemy.super.call(this, view);
});

/**
 * Function to execute on the client side, when the scene is made
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.0.7
 *
 * @param    {Scene}   scene
 * @param    {Object}  options
 */
Alchemy.setStatic(function onScene(scene, options) {
	window.alchemy.initScene(scene, options);
});

/**
 * Perform a resource request
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.0.1
 * @version  0.5.0
 *
 * @param    {String|Object}   options
 * @param    {Object}          data
 * @param    {Function}        callback
 */
Alchemy.setMethod(function getResource(options, data, callback) {

	var that = this,
	    conduit,
	    config,
	    url;

	if (typeof options == 'string') {
		options = {
			name : options
		};
	}

	if (Blast.isNode) {
		conduit = this.view.server_var('conduit');

		if (!conduit) {
			return callback(new Error('Could not find conduit, alchemy resource will not be fetched'));
		}

		if (typeof data == 'function') {
			callback = data;
			data = null;
		} else {
			options.params = data;
		}

		conduit.loopback(options, callback);

		return;
	}

	if (typeof data == 'function') {
		callback = data;
		data = null;
	}

	if (!callback) {
		callback = Blast.Bound.Function.thrower;
	}

	// See if this is a socket route
	config = this.view.helpers.Router.routeConfig(options.name, true);

	if (config && config.socket_route) {
		// In this case the "alchemy" variable points to the window.alchemy object
		alchemy.submit(config.name, data, callback);
		return;
	}

	// Get the url to the resource
	url = hawkejs.scene.helpers.Router.routeUrl(options.name, options.params);

	if (!url && typeof name == 'string') {
		url = hawkejs.scene.helpers.Router.routeUrl('APIResource', {name: options.name});
	}

	if (!url) {
		return callback(new Error('No URL could be found for route "' + options.name + '"'));
	}

	hawkejs.scene.fetch(url, {get: data}, callback);
});

/**
 * Register & recompile a callback
 *
 * @author        Jelle De Loecker   <jelle@develry.be>
 * @since         0.2.0
 * @version       0.2.0
 *
 * @param         {Function}   callback
 *
 * @return        {Function}
 */
Alchemy.setMethod(function registerCallback(callback) {

	if (!this.callbacks) {
		this.callbacks = {};
	}

	// The callback will need to be recompiled
	if (!this.callbacks[callback.name]) {
		this.callbacks[callback.name] = this.view.hawkejs.compile({

			// The function that will be re-compiled
			compiled: callback,

			// Template name
			template_name: 'callback_' + callback.name,

			// It's a single function that needs to be called with the 'group_arg' var
			call: 'group_arg',

			// Make sure these variables are available in the scope
			scope: this.view.functionScopes.slice(0)
		});
	}

	return this.callbacks[callback.name];
});

/**
 * Register a group and possible id
 *
 * @author        Jelle De Loecker   <jelle@develry.be>
 * @since         0.2.0
 * @version       0.2.0
 */
Alchemy.setMethod(function registerGroup(name, id, callback) {

	// Make sure the groups exist
	if (!this.groups) {
		this.groups = {};
	}

	if (!this.groups[name]) {
		this.groups[name] = {
			state: 'new',
			hinder: null,
			ids: []
		};
	}

	if (id && !this.groups[name].ids[id]) {
		this.groups[name].ids[id] = [];
	}

	if (callback) {
		this.registerCallback(callback);
		this.groups[name].ids[id].push(callback);
	}
});

/**
 * Get the group data
 *
 * @author        Jelle De Loecker   <jelle@develry.be>
 * @since         0.2.0
 * @version       0.2.0
 */
Alchemy.setMethod(function getGroupData(name, callback) {

	var that = this,
	    group;

	group = this.groups[name];

	if (!group.hinder) {
		group.hinder = Function.hinder(function getData(done) {
			that.getResource(name, {ids: Object.keys(group.ids)}, done);
		});
	}

	if (callback) group.hinder.push(callback);
});

/**
 * Aggregate data.
 * The callback needs to be named and be unique per scope structure
 *
 * @author        Jelle De Loecker   <jelle@develry.be>
 * @since         0.2.0
 * @version       0.2.0
 */
Alchemy.setMethod(function group(name, id, callback) {

	var that = this,
	    scope;

	// Keep reference to the current scope
	scope = this.view.functionScopes.slice(0);

	// Register the group and callback
	this.registerGroup(name, id, callback);

	// Return an async placeholder
	this.view.async(function doAsync(next) {
		that.getGroupData(name, function gotData(err, data) {

			var id_data;

			if (err) {
				return next(err);
			}

			if (data) {
				id_data = data[id];
			}

			that.view.hawkejs.render(that.registerCallback(callback), {__scope: scope, group_arg: id_data}, next);
		});
	});
});

/**
 * Print a segment
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.5.0
 * @version  0.5.0
 *
 * @param    {String|Object}   options
 * @param    {Object}          data
 */
Alchemy.setMethod(function segment(options, data) {

	var that = this,
	    root;

	if (typeof options == 'string') {
		options = {
			name : options
		};
	}

	// Return an async placeholder
	root = this.view.async(function doAsync(next) {

		var conduit,
		    route,
		    el;

		if (Blast.isNode) {
			conduit = that.view.server_var('conduit');

			if (!conduit) {
				return next();
			}

			options.params = data;

			conduit.loopback(options, next);

			return;
		}

		// @TODO: implement a cleaner way of doing this
		// A lot of the attributes are missing
		el = document.createElement('x-hawkejs');
		el.classList.add('x-hawkejs');
		el.classList.add('js-he-newblock');
		el.dataset.segmentRoute = options.name;
		el.dataset.type = 'element';
		root.element = el;

		// Get the route configuration
		route = that.view.helpers.Router.routeUrl(options.name);

		hawkejs.scene.openUrl(route, {get: data, history: false, root: root}, function done(err, result) {

			if (err) {
				return next(err);
			}

			next(null, el.outerHTML);
		});
	});
});

if (!Blast.isBrowser) {
	return;
}

// Send a message to the server when we unload the page
window.addEventListener('unload', function(event) {
	if (console) {
		console.log('Unloading the page ...');
	}
});