var instances = {};

/**
 * Datasource
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 */
Blast.Globals.Datasource = Function.inherits('Alchemy.Base', 'Alchemy.Datasource', function Datasource(name, options) {

	this.name = name;

	this.options = Object.assign(this.options || {}, options);
});

/**
 * Make this an abtract class
 */
Datasource.makeAbstractClass();

/**
 * This class starts a new group
 */
Datasource.startNewGroup();

/**
 * Enable query caching according to settings
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setProperty('queryCache', !!alchemy.settings.model_query_cache_duration);

/**
 * Set support flag for something
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.7
 * @version  1.0.7
 *
 * @param    {String}   name
 * @param    {Boolean}  value
 */
Datasource.setStatic(function setSupport(name, value) {
	this.constitute(function doSetSupport() {

		if (!this._support_flags) {
			this._support_flags = {};
		}

		this._support_flags[name] = value;
	});
});

/**
 * See if this supports the given flag
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.7
 * @version  1.0.7
 *
 * @param    {String}   name
 *
 * @return   {Boolean}
 */
Datasource.setStatic(function supports(name) {

	if (!this._support_flags) {
		return null;
	}

	return this._support_flags[name];
});

/**
 * Instance method alias for support flags
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.0.7
 * @version  1.0.7
 *
 * @param    {String}   name
 *
 * @return   {Boolean}
 */
Datasource.setMethod(function supports(name) {
	return this.constructor.supports(name);
});

/**
 * Hash a string synchronously
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {String}   str
 *
 * @return   {String}
 */
Datasource.setMethod(function hashString(str) {
	return Object.checksum(str);
});

/**
 * Get a schema
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.1.0
 * @version  1.1.0
 *
 * @param    {Schema}   schema
 *
 * @return   {Schema}
 */
Datasource.setMethod(function getSchema(schema) {
	if (schema != null) {
		let is_schema;

		is_schema = schema instanceof Blast.Classes.Alchemy.Client.Schema;

		if (!is_schema && Blast.Classes.Alchemy.Schema) {
			is_schema = schema instanceof Blast.Classes.Alchemy.Schema;
		}

		if (!is_schema) {
			schema = getSchema(schema.schema);
		}
	}

	return schema;
});

/**
 * Prepare record to be stored in the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 *
 * @param    {Schema|Model}   schema
 * @param    {Object}         data
 *
 * @return   {Pledge}
 */
Datasource.setMethod(function toDatasource(schema, data, callback) {

	var that = this,
	    pledge = new Classes.Pledge(),
	    tasks;

	schema = this.getSchema(schema);

	if (Object.isPlainObject(schema)) {
		pledge = Pledge.reject(new Error('The provided schema was a regular object'));
		pledge.done(callback);
		return pledge;
	}

	if (!schema) {
		log.todo('Schema not found: not normalizing data');
		pledge = Pledge.resolve(data);
		pledge.done(callback);
		return pledge;
	}

	data = Object.assign({}, data);
	tasks = {};

	Object.each(data, function eachField(value, fieldName) {

		var field = schema.get(fieldName);

		if (field != null) {
			tasks[fieldName] = function doToDatasource(next) {
				that.valueToDatasource(field, value, data, next);
			};
		}
	});

	Function.parallel(tasks, async function done(err, result) {

		if (err) {
			return pledge.reject(err);
		}

		// Also process the $_extra_fields through the toDatasource methods
		// but only once (another round of $_extra_fields are ignored)
		if (data.$_extra_fields) {
			let sub_tasks = {},
			    sub_data = Object.assign({}, data.$_extra_fields);

			for (let key in data.$_extra_fields) {
				let value = data.$_extra_fields[key],
				    field = schema.get(key);

				// If no field was found, just use it as-is
				if (!field) {
					result[key] = value;
					continue;
				}

				sub_tasks[key] = function doToDatasource(next) {
					that.valueToDatasource(field, value, sub_data, next);
				};
			}

			sub_data = await Function.parallel(sub_tasks);

			Object.assign(result, sub_data);
		}

		pledge.resolve(result);
	});

	pledge.done(callback);

	return pledge;
});

/**
 * Prepare to return the record from the database to the app
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 *
 * @param    {Schema|Model}   schema
 * @param    {Object}         query
 * @param    {Object}         options
 * @param    {Object}         data
 *
 * @return   {Pledge}
 */
Datasource.setMethod(function toApp(schema, query, options, data, callback) {

	var pledge;

	if (!data) {
		pledge = Pledge.reject(new Error('Unable to convert data: no data given'));
		pledge.done(callback);
		return pledge;
	}

	let that = this,
	    tasks;

	schema = this.getSchema(schema);

	if (schema == null) {
		log.todo('Schema not found: not unnormalizing data');

		let pledge = Pledge.resolve(data);
		pledge.done(callback);

		return pledge;
	}

	if (data[schema.name]) {
		tasks = {};

		for (let key in data) {
			let value = data[key],
			    data_schema;

			if (key == schema.name) {
				data_schema = schema;
			} else {
				let info = schema.associations[key];

				// Ignore associations we know nothing of
				if (!info) {
					continue;
				}

				let model = this.getModel(info.modelName, false);

				if (!model) {
					continue;
				}

				data_schema = model.schema;
			}

			tasks[key] = function addData(next) {

				// Associated data can return multiple items, so we need to unwind that
				if (Array.isArray(value)) {
					let sub_tasks = [],
					    i;

					for (i = 0; i < value.length; i++) {
						let row = value[i];
						sub_tasks.push(function doRow(next) {
							that.toApp(data_schema, query, options, row, next);
						});
					}

					Function.parallel(4, sub_tasks, next);
				} else {
					that.toApp(data_schema, query, options, value, next);
				}
			};
		}

		return Function.parallel(tasks, callback);
	}

	data = Object.assign({}, data);
	tasks = {};

	options = Object.assign({}, options);

	if (!options._root_data) {
		options._root_data = data;
	}

	Object.each(data, function eachField(value, fieldName) {

		var field = schema.get(fieldName);

		if (field != null) {
			tasks[fieldName] = function doToDatasource(next) {
				that.valueToApp(field, query, options, value, next);
			};
		} else if (options.extraneous) {
			tasks[fieldName] = function addExtraneous(next) {
				next(null, value);
			};
		}
	});

	pledge = Function.parallel(tasks, callback);

	return pledge;
});

/**
 * Prepare value to be stored in the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function valueToDatasource(field, value, data, callback) {

	var that = this;

	field.toDatasource(value, data, this, function gotDatasourceValue(err, value) {

		if (err) {
			return callback(err);
		}

		that._valueToDatasource(field, value, data, callback);
	});
});

/**
 * Prepare value to be returned to the app
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function valueToApp(field, query, options, value, callback) {

	var that = this;

	field.toApp(query, options, value, function gotToAppValue(err, value) {

		if (err) {
			return callback(err);
		}

		that._valueToApp(field, query, options, value, callback);
	});
});

/**
 * Prepare value to be stored in the database.
 * Should be overridden by extended datasources.
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 */
Datasource.setMethod(function _valueToDatasource(field, value, data, callback) {
	Blast.setImmediate(function immediateDelay() {
		callback(null, value);
	});
});

/**
 * Prepare value to be returned to the app.
 * Should be overridden by extended datasources.
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 */
Datasource.setMethod(function _valueToApp(field, query, options, value, callback) {
	Blast.setImmediate(function immediateDelay() {
		callback(null, value);
	});
});

/**
 * Query the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 *
 * @param    {Model}      model
 * @param    {Criteria}   criteria
 */
Datasource.setMethod(function read(model, criteria, callback) {

	var that = this,
	    pledge = new Pledge(),
	    hash;

	pledge.done(callback);

	// Look through the cache first
	if (this.queryCache && model.cache) {

		// Create a hash out of the criteria
		hash = 'criteria-' + Object.checksum(criteria);

		// See if it's in the cache
		let cached = model.cache.get(hash, true);

		if (cached) {
			cached.done(function gotCached(err, result) {

				if (err) {
					return pledge.reject(err);
				}

				model.emit('fetching_cache', criteria);

				// Clone the cached value
				result = JSON.clone(result);

				model.emit('fetched_cache', criteria, result);

				pledge.resolve(result);
			});

			return pledge;
		}
	}

	let cache_pledge;

	if (hash && model.cache && this.queryCache) {
		cache_pledge = new Pledge();
	}

	// Nothing in the cache, so do the actual reading
	that._read(model, criteria, function afterRead(err, results, available) {

		var sub_pledge,
		    tasks,
		    i;

		if (err) {
			return pledge.reject(err);
		}

		tasks = results.map(function eachEntry(entry) {
			return function entryToApp(next) {
				that.toApp(model, criteria, {}, entry, next);
			};
		});

		sub_pledge = Function.parallel(tasks, function done(err, app_results) {

			if (err) {
				return pledge.reject(err);
			}

			let result = {
				items     : app_results,
				available : available
			};

			if (hash) {
				let cloned = JSON.clone(result);

				// Emit the storing_cache event
				model.emit('storing_cache', criteria, cloned);

				cache_pledge.resolve(cloned);
			}

			pledge.resolve(result);
		});

		pledge._addProgressPledge(sub_pledge);
	});

	if (this.queryCache && model.cache && cache_pledge) {
		// Store the pledge in the cache
		model.cache.set(hash, cache_pledge);
	}

	return pledge;
});

/**
 * Insert new data into the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.0.6
 *
 * @param    {Model}      model
 * @param    {Object}     data
 * @param    {Object}     options
 * @param    {Function}   callback
 *
 * @return   {Pledge}
 */
Datasource.setMethod(function create(model, data, options, callback) {

	var that = this,
	    pledge;

	pledge = Function.series(false, function toDatasource(next) {
		// Convert the data into something the datasource will understand
		that.toDatasource(model, data, next);
	}, function emitToDatasource(next, ds_data) {
		model.emit('to_datasource', data, ds_data, options, true, function afterTDSevent(err, stopped) {
			next(err, ds_data);
		});
	}, function doCreate(next, ds_data) {
		that._create(model, ds_data, options, next);
	}, function gotUpdateResult(next, result) {
		that.toApp(model, null, options, result, next);
	}, function done(err, result) {

		if (err) {
			return;
		}

		return result.last();
	});

	pledge.done(callback);

	return pledge;
});

/**
 * Update data
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.0.6
 *
 * @param    {Model}      model
 * @param    {Object}     data
 * @param    {Object}     options
 * @param    {Function}   callback
 *
 * @return   {Pledge}
 */
Datasource.setMethod(function update(model, data, options, callback) {

	var that = this,
	    pledge;

	if (options.set_updated !== false) {
		// Set the updated field
		data.updated = new Date();
	}

	pledge = Function.series(false, function toDatasource(next) {
		// Convert the data into something the datasource will understand
		that.toDatasource(model, data, next);
	}, function emitToDatasource(next, ds_data) {
		model.emit('to_datasource', data, ds_data, options, false, function afterTDSevent(err, stopped) {
			next(err, ds_data);
		});
	}, function doUpdate(next, ds_data) {
		that._update(model, ds_data, options, next);
	}, function gotUpdateResult(next, result) {
		that.toApp(model, null, options, result, next);
	}, function done(err, result) {

		if (err) {
			return;
		}

		return result.last();
	});

	pledge.done(callback);

	return pledge;
});

/**
 * Remove data from the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function remove(model, query, options, callback) {
	this._remove(model, query, options, callback);
});

/**
 * Ensure an index in the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.3.0
 */
Datasource.setMethod(function ensureIndex(model, index, callback) {

	if (typeof callback != 'function') {
		callback = Function.thrower;
	}

	this._ensureIndex(model, index, callback);
});

/**
 * Insert new data into the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @param    {Model}     model
 * @param    {Object}    data
 * @param    {Object}    options
 * @param    {Function}  callback
 *
 * @return   {Pledge}
 */
Datasource.setMethod(function _create(model, data, options, callback) {
	return this.createRejectedPledge('_create', callback);
});

/**
 * Query the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function _read(model, query, options, callback) {
	return this.createRejectedPledge('_read', callback);
});

/**
 * Update data
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function _update(model, data, options, callback) {
	return this.createRejectedPledge('_update', callback);
});

/**
 * Remove data from the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function _remove(model, query, options, callback) {
	return this.createRejectedPledge('_remove', callback);
});

/**
 * Ensure an index in the database
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  0.2.0
 */
Datasource.setMethod(function _ensureIndex(model, index, callback) {
	return this.createRejectedPledge('_ensureIndex', callback);
});

/**
 * Return a rejected pledge
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.1.0
 * @version  1.1.0
 */
Datasource.setMethod(function createRejectedPledge(method, callback) {
	var pledge = Pledge.reject(new Error(method + ' method was not defined for ' + this.constructor.name + ' "' + this.name + '"'));
	pledge.done(callback);
	return pledge;
});

/**
 * Setup the datasource
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.1.0
 * @version  1.1.0
 */
Datasource.setMethod(function setup(callback) {

	var that = this,
	    tasks = [];

	// If this datasource needs to establish some kind of connection,
	// do that first
	if (typeof this.connect == 'function') {
		let pledge = this.connect();
		tasks.push(pledge);
	}

	if (typeof this.configureTable == 'function') {
		tasks.push(function getAllModels(next) {

			let models = that.getModels();

			if (!models.length) {
				return next();
			}

			let sub_tasks = [],
			    i;

			for (i = 0; i < models.length; i++) {
				let ModelClass = models[i];

				sub_tasks.push(async function doTableConfig(next) {
					await that.configureTable(ModelClass)
					next();
				});
			}

			Function.parallel(4, sub_tasks, next);
		});
	}

	return Function.series(tasks, callback);
});

/**
 * Get all model classes that connect through this datasource
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.1.0
 * @version  1.1.0
 *
 * @return   {Array}
 */
Datasource.setMethod(function getModels() {

	var result = [],
	    model,
	    all = Model.getAllChildren(),
	    i;

	for (i = 0; i < all.length; i++) {
		model = all[i];

		if (model.prototype.dbConfig != this.name) {
			continue;
		}

		if (this.isAbstractModel(model)) {
			continue;
		}

		result.push(model);
	}

	return result;
});

/**
 * Is the given model an abstract model?
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    1.1.0
 * @version  1.1.0
 *
 * @param    {Function}   model
 *
 * @return   {Boolean}
 */
Datasource.setMethod(function isAbstractModel(model) {
	return !!model.is_abstract;
});

/**
 * Create a new datasource
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 *
 * @param    {String}   type      The type of datasource to create
 * @param    {String}   name      The internal name of the datasource
 * @param    {Object}   options   Configuration options for the datasource
 *
 * @return   {Datasource}
 */
Datasource.create = function create(type, name, options) {

	var constructor = Datasource.getMember(type);

	if (!constructor) {
		throw new Error('Datasource type "' + type + '" does not exist');
	}

	let instance = new constructor(name, options);
	instances[name] = instance;

	return instance;
};

/**
 * Get a datasource instance
 *
 * @author   Jelle De Loecker   <jelle@develry.be>
 * @since    0.2.0
 * @version  1.1.0
 *
 * @return   {Datasource}
 */
Datasource.get = function get(name) {

	var ds;

	if (!arguments.length) {
		return instances;
	}

	if (typeof name == 'string') {
		ds = instances[name];
	} else if (name instanceof Datasource) {
		ds = name;
	} else if (name) {

		if (!name.type) {
			throw new Error('Unable to create Datasource without a type');
		}

		if (!name.name) {
			throw new Error('Unable to create Datasource without giving it a name');
		}

		ds = Datasource.create(name.type, name.name, name.options || name);
	} else {
		throw new Error('Wrong arguments passed to Datasource.get()');
	}

	return ds;
};