/**
 * The Schema class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 */
var Schema = Deck.extend(function Schema() {

	Deck.call(this);

	// Default index options
	this.indexOptions = {
		unique: false,
		order: 1 // Ascending
	};

	this.associations = {};

	// All index groups
	this.indexes = {};

	// All fields belonging to an index group
	this.indexFields = {};

});

/**
 * Add a field to this schema
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   name
 * @param    {String}   type
 * @param    {Object}   options
 *
 * @return   {FieldType}
 */
Schema.setMethod(function addField(name, type, options) {

	var FieldClass,
	    className,
	    field;

	className = type + 'FieldType';

	if (!alchemy.classes[className]) {
		className = 'FieldType';
	}

	field = new alchemy.classes[className](name, options);

	this.set(name, field);

	return field;
});

/**
 * Get a field
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   name
 *
 * @return   {FieldType}
 */
Schema.setMethod(function getField(name) {

	if (name instanceof FieldType) {
		return name;
	}

	return this.get(name);
});

/**
 * Get all indexes to check for the given record
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Object}   data
 *
 * @return   {Object}
 */
Schema.setMethod(function getRecordIndexes(data) {

	var fieldName,
	    indexName,
	    result;

	result = {};

	for (fieldName in data) {
		if (this.indexFields[fieldName] != null) {
			indexName = this.indexFields[fieldName].name;
			result[indexName] = this.indexes[indexName];
		}
	}

	return result;
});

/**
 * Convenience method for iterating over indexes of a given record
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {Object}   data
 *
 * @return   {Object}
 */
Schema.setMethod(function eachRecordIndex(data, fnc) {
	Object.each(this.getRecordIndexes(data), fnc);
});

/**
 * Add an index
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String|FieldType}   _field
 * @param    {Object}             options
 *
 * @return   {FieldType}
 */
Schema.setMethod(function addIndex(_field, _options) {

	var options,
	    order,
	    field = this.getField(_field);

	if (typeof _options === 'string') {
		options = {};
		options[_options] = true;
	} else {
		options = _options;
	}

	// Set the default options
	options = Object.assign({}, this.indexOptions, options);

	if (options.name == null) {
		options.name = field.name;

		if (options.unique) {
			options.name += '_uq';
		}
	}

	if (typeof options.order == 'number') {
		if (options.order == 'asc') {
			options.order = 1;
		} else {
			options.order = -1;
		}
	}

	if (this.indexes[options.name] == null) {
		// Create the index group if it doesn't exist yet.
		// The first time it's called will define the group options.
		this.indexes[options.name] = {
			fields: {},
			options: options
		};
	}

	// Store the field order in the index groups
	this.indexes[options.name].fields[field.name] = options.order;
	this.indexFields[field.name] = options;
});

/**
 * Conform association arguments
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   locality       internal or external
 * @param    {String}   _alias
 * @param    {String}   _modelname
 * @param    {Object}   _options
 */
Schema.setMethod(function getAssociationArguments(locality, _alias, _modelname, _options) {

	var modelName = _modelname,
	    options = _options,
	    alias = _alias;

	if (Object.isObject(modelName)) {
		options = modelName;
		modelName = undefined;
	} else if (!Object.isObject(options)) {
		options = {};
	}

	if (typeof modelName === 'undefined') {
		modelName = alias;
	}

	if (locality == 'internal') {

		if (!options.localKey) {
			options.localKey = alias.foreign_key();
		}

		if (!options.foreignKey) {
			options.foreignKey = '_id';
		}
	} else {

		if (!options.localKey) {
			options.localKey = '_id';
		}

		if (!options.foreignKey) {
			options.foreignKey = alias.foreign_key();
		}
	}

	return {alias: alias, modelName: modelName, options: options}
});

/**
 * Add an association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function addAssociation(type, alias, modelName, options) {

	var locality,
	    singular;

	// Determine the locality
	switch (type) {
		case 'HasOneParent':
		case 'HasAndBelongsToMany':
		case 'BelongsTo':
			locality = 'internal';
			break;

		case 'HasMany':
		case 'HasOneChild':
			locality = 'external';
			break;

		default:
			throw new TypeError('Association type "' + type + '" does not exist');
	}

	// Determine if it's a single record to be found
	switch (association.type) {
		case 'HasOneParent':
		case 'HasOneChild':
		case 'BelongsTo':
		case 'HasOne':
			singular = true;
			break;

		default:
			singular = false;
	}

	args = this.getAssociationArguments(locality, alias, modelName, options);

	alias = args.alias;
	modelName = args.modelName;
	options = args.options;
	options.singular = singular;

	if (locality == 'internal') {
		this.addField(options.localKey, type, args);
	}

	this.associations[alias] = args;
});

/**
 * Add a belongsTo association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function belongsTo(alias, modelName, options) {
	this.addAssociation('BelongsTo', alias, modelName, options);
});

/**
 * Add a hasOneParent association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function hasOneParent(alias, modelName, options) {
	this.addAssociation('HasOneParent', alias, modelName, options);
});

/**
 * Add a HABTM association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function hasAndBelongsToMany(alias, modelName, options) {
	this.addAssociation('HasAndBelongsToMany', alias, modelName, options);
});

/**
 * Add a hasMany association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function hasMany(alias, modelName, options) {
	this.addAssociation('HasMany', alias, modelName, options);
});

/**
 * Add a hasOneChild association
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 *
 * @param    {String}   alias
 * @param    {String}   modelname
 * @param    {Object}   options
 */
Schema.setMethod(function hasOneChild(alias, modelName, options) {
	this.addAssociation('HasOneChild', alias, modelName, options);
});

/**
 * Process the given object
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 */
Schema.setMethod(function process(data, options) {

	var fields,
	    result,
	    field,
	    i;

	if (options == null) {
		options = {};
	}

	fields = this.getSorted(false);
	result = {};

	for (i = 0; i < fields.length; i++) {
		field = fields[i];

		if (Object.hasProperty(data, field.name)) {
			result[field.name] = field.getValue(data[field.name]);
		} else if (field.hasDefault) {
			result[field.name] = field.getDefault();
		}
	}

	// @todo: improve allowFields support
	if (options.allowFields) {
		for (key in data) {

			// Skip fields we've already done,
			// which is everything in the blueprint
			if (!this.get(key)) {
				result[key] = data[key];
			}
		}
	}

	return result;
});