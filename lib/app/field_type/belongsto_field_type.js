/**
 * The BelongsToFieldType class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    1.0.0
 * @version  1.0.0
 */
var BelongsToFieldType = Function.inherits('ObjectIdFieldType', function BelongsToFieldType(name, options) {
	BelongsToFieldType.super.call(this, name, options);

	// @todo: set index stuff
});

alchemy.classes.BelongsToFieldType = BelongsToFieldType;