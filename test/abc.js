var assert = require('assert'),
    MongoUnit = require('mongo-unit'),
    mongo_uri;

var Person,
    person_doc;

// Make sure janeway doesn't start
process.env.DISABLE_JANEWAY = 1;

// Require alchemymvc
require('../index.js');

describe('require(\'alchemymvc\')', function() {
	it('should create the global alchemy object', function() {
		assert.equal('object', typeof alchemy);
	});
});

describe('Mongo-unit setup', function() {
	this.timeout(70000)

	it('should create in-memory mongodb instance first', async function() {

		var url = await MongoUnit.start();

		mongo_uri = url;

		if (!url) {
			throw new Error('Failed to create mongo-unit instance');
		}
	});
});

describe('Alchemy', function() {

	describe('#start(callback)', function() {
		it('should start the server', function(done) {
			alchemy.start({silent: true}, function started() {
				done();
			});

			// Also create the mongodb datasource
			Datasource.create('mongo', 'default', {uri: mongo_uri});
		});
	});
});

describe('Model', function() {

	var data,
	    _id;

	data = {
		firstname : 'Jelle',
		lastname  : 'De Loecker',
		nicknames : ['skerit', 'Jellie'],
		birthdate : new Date('1987-10-29'),
		male      : true
	};

	function testDocument(document, data) {
		assert.strictEqual(document.firstname,     data.firstname);
		assert.strictEqual(document.lastname,      data.lastname);
		assert.deepStrictEqual(document.nicknames, data.nicknames);
		assert.strictEqual(document.birthdate+'',  data.birthdate+'');
		assert.strictEqual(document.male,          data.male);
		assert.strictEqual(String(document._id).isObjectId(), true);
	}

	/**
	 * Inheritance testing
	 */
	describe('inheritance', function() {
		it('lets you inherit from the main Model class', function() {
			Person = Function.inherits('Alchemy.Model', function Person(options) {
				Person.super.call(this, options);
			});

			assert.strictEqual(Person.super, Classes.Alchemy.Model.Model, true);
		});
	});

	/**
	 * Adding fields to the new Model
	 */
	describe('.addField(name, type, options)', function() {
		it('should add fields (during constitution)', function(done) {
			Person.constitute(function addFields() {

				this.addField('firstname', 'String');
				this.addField('lastname',  'String');
				this.addField('nicknames', 'String', {array: true});
				this.addField('birthdate', 'Date');
				this.addField('male',      'Boolean');

				done();
			});
		});
	});

	/**
	 * Get the Document class for this model
	 */
	describe('.Document', function() {
		it('should create a Document class for this specific Model', function() {

			var PersonDocument = Person.Document;

			assert.strictEqual(PersonDocument,      Person.Document, 'Should return the same constructor instance');
			assert.strictEqual(PersonDocument.name, Person.name,     'The Document class should have the same name as the Model');
			assert.notStrictEqual(PersonDocument,   Person,          'The model & the document are different things');
		});
	});

	/**
	 * Get the ClientDocument class for this model
	 */
	describe('.ClientDocument', function() {
		it('should create a ClientDocument class for this specific Model', function() {

			var PersonDocument = Person.ClientDocument;

			assert.strictEqual(PersonDocument,      Person.ClientDocument, 'Should return the same constructor instance');
			assert.strictEqual(PersonDocument.name, Person.name,           'The Document class should have the same name as the Model');
			assert.notStrictEqual(PersonDocument,   Person,                'The model & the document are different things');
			assert.notStrictEqual(PersonDocument,   Person.Document,       'The ClientDocument & the Document are different things');
		});
	});

	/**
	 * Add Document methods
	 */
	describe('.setDocumentMethod(fnc)', function() {
		it('adds a new method to the Document class', function() {
			Person.setDocumentMethod(function getFamiliarName() {
				var result;

				if (this.firstname) {
					return this.firstname;
				} else if (this.nicknames && this.nicknames[0]) {
					return this.nicknames[0];
				} else if (this.lastname) {
					return this.lastname;
				} else {
					return 'Unknown';
				}
			});

			assert.strictEqual(Person.Document.prototype.getFamiliarName.name, 'getFamiliarName');
			assert.strictEqual(Person.ClientDocument.prototype.getFamiliarName, undefined);
		});
	});

	/**
	 * Getting an instance of the model
	 */
	describe('.get(model_name)', function() {
		it('should create a new instance of the wanted model', function() {

			var person = Model.get('Person');

			assert.strictEqual(person instanceof Person, true);
			assert.strictEqual(person instanceof Classes.Alchemy.Model.Model, true);

		});
	});

	/**
	 * Saving data
	 */
	describe('.save(data, callback)', function() {

		it('should save the data and call back with a DocumentList', function(done) {

			Model.get('Person').save(data, function saved(err, list) {

				if (err) {
					return done(err);
				}

				assert.strictEqual(list.length, 1);

				let document = list[0];

				testDocument(document, data);

				// Save the _id for next tests
				_id = document._id;

				// Save this for later tests
				person_doc = document;

				done();
			});
		});
	});

	/**
	 * Getting data
	 */
	describe('.find(\'first\', options, callback)', function() {
		it('should find 1 document by ObjectId instance', function(done) {
			Model.get('Person').find('first', {conditions: {_id: _id}}, function gotDocument(err, document) {

				if (err) {
					return done(err);
				}

				try {

					assert.notStrictEqual(document instanceof Classes.Alchemy.DocumentList, true, 'Should not have returned a DocumentList');
					assert.strictEqual(document instanceof Classes.Alchemy.Document.Document, true, 'Should have returned a Document');

					assert.strictEqual(String(document._id), String(_id));

					testDocument(document, data);
				} catch (err) {
					return done(err);
				}

				done();
			});
		});

		it('should find 1 document by ObjectId string', function(done) {
			Model.get('Person').find('first', {conditions: {_id: String(_id)}}, function gotDocument(err, document) {

				if (err) {
					return done(err);
				}

				try {
					assert.notStrictEqual(document instanceof Classes.Alchemy.DocumentList, true, 'Should not have returned a DocumentList');
					assert.strictEqual(document instanceof Classes.Alchemy.Document.Document, true, 'Should have returned a Document');

					assert.strictEqual(String(document._id), String(_id));

					testDocument(document, data);
				} catch (err) {
					return done(err);
				}

				done();
			});
		});
	});
});

describe('Document', function() {

	describe('.setMethod(fnc)', function() {
		it('should set custom methods on the given Document class', function() {
			// Already set one earlier
			assert.strictEqual(person_doc.getFamiliarName(), 'Jelle');
		});
	});

	describe('.setProperty(getter)', function() {
		it('should add a custom property on the given Document class', function() {

			Person.Document.setProperty(function familiar_name() {
				return this.getFamiliarName();
			});

			assert.strictEqual(person_doc.familiar_name, 'Jelle');

			var empty_doc = new Person.Document();

			assert.strictEqual(empty_doc.familiar_name, 'Unknown');

			var base_doc = new Classes.Alchemy.Document.Document();
			assert.strictEqual(base_doc.familiar_name, undefined);
		});
	});

	describe('model field properties', function() {
		it('should refer to the $main object', function() {
			assert.strictEqual(person_doc.firstname, person_doc.$main.firstname);
			assert.strictEqual(person_doc.nicknames, person_doc.$main.nicknames);
			assert.strictEqual(person_doc.birthdate, person_doc.$main.birthdate);
			assert.strictEqual(person_doc.Person,    person_doc.$main);
		});

		it('should overwrite the original values', function() {
			person_doc.firstname = 'Jellie';
			assert.strictEqual(person_doc.firstname, 'Jellie');
			assert.strictEqual(person_doc.firstname, person_doc.$main.firstname);
			person_doc.firstname = 'Jelle';
		});
	});

	describe('#model', function() {
		it('should return an instance of the Model of the Document', function() {
			var new_doc = new Classes.Alchemy.Document.Person(),
			    model;

			model = new_doc.$model;

			assert.strictEqual(model.constructor.name, 'Person');
		});
	});

	describe('#clone()', function() {
		it('should clone the Document', function() {

			var clone = person_doc.clone();

			// It should NOT be the same reference
			assert.notStrictEqual(clone.$main, person_doc.$main);

			// It SHOULD contain the same values
			assert.deepStrictEqual(clone.$main, person_doc.$main);

			clone.firstname = 'Clonie';

			assert.strictEqual(clone.firstname,      'Clonie');
			assert.strictEqual(person_doc.firstname, 'Jelle');
			assert.strictEqual(clone.familiar_name,  'Clonie');

		});
	});

	describe('#toHawkejs()', function() {
		it('should return a ClientDocument instance', function() {
			var client_doc = person_doc.toHawkejs();

			assert.strictEqual(client_doc.firstname,     person_doc.firstname);
			assert.strictEqual(client_doc.lastname,      person_doc.lastname);
			assert.strictEqual(client_doc.familiar_name, undefined);
		});
	});

	describe('#get(field_name)', function() {
		it('should return the value of the given field name', function() {
			var firstname = person_doc.get('firstname');

			assert.strictEqual(firstname, 'Jelle');
		});
	});

	describe('#get(alias, field_name)', function() {
		it('should return the value of the field name of the wanted alias', function() {
			var firstname = person_doc.get('Person', 'firstname');
			assert.strictEqual(firstname, 'Jelle');

			var does_not_exist = person_doc.get('SomethingElse', 'firstname');
			assert.strictEqual(does_not_exist, undefined);
		});
	});
});

describe('Teardown', function() {
	it('should stop the services', function() {
		MongoUnit.stop();
		alchemy.stop();
	});
});