const run = require( './verifyImages.js' )

var args = { "arguments": [] }

const cmdLineArgs = process.argv.slice( 2 )

Object.keys( cmdLineArgs ).forEach( ( entry ) =>
{
	const [ key, value ] = cmdLineArgs[ entry ].split( "=" )

	args.arguments[ `${ key }` ] = value
} )

run.run( args )
