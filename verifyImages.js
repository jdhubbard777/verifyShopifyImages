const fs = require( 'fs' )
const path = require( 'path' )
const fetch = require( 'node-fetch' )
const xlsx = require( 'xlsx' )
const https = require( 'https' )
const request = require( 'request' )
const urlExists = require( 'url-exists' )
const url = require( 'url' )

// const catalogBaseFolder = "C:/Users/NightOwl/Documents/Business Formation/SecretFantasyBoutique/Suppliers/ElegantMoments/Product Catalogs/"
const catalogBaseFolder = "C:/Users/NightOwl/My Drive/Documents/Business Formation/SecretFantasyBoutique/Suppliers/ElegantMoments/Product Catalogs/"

const catalogImagesFolder = `${ catalogBaseFolder }Images/`

const masterImagesFolder = `${ catalogImagesFolder }AllImages/`


const shopifyImageUploadFolder = `${ catalogImagesFolder }ShopifyUploadImages/`


const shopifyImageUrl = "https://cdn.shopify.com/s/files/1/0557/4780/5269/files/"

// const catalogNames = [ '2022_Collection_Descriptions', '2020-2021_Vivace_Descriptions' ]
// const listOfCatalogs = [ '2020-2021-Vivace', '2022-Vivace', 'Hosiery' ]
// const supplierImagesFolder = "https://cdn.shopify.com/s/files/1/1540/8191/products/"


// Perform https request for provided url
const verifyImage = ( URL ) =>
{
	const address = url.parse( URL, true )

	const options = {
		hostname: address.hostname,
		path: address.path,
		method: 'GET'
	}

	return new Promise( ( resolve, reject ) =>
	{
		https.request( options, ( res ) =>
		{
			if ( res.statusCode === 200 )
			{
				resolve( true )
			}
			else
			{
				resolve( false )
			}
		} ).on( 'error', ( err ) =>
		{
			reject( err )
		} ).end()
	} )
}


function getHeader ( sheet )
{
	var headers = []
	var range = xlsx.utils.decode_range( sheet[ '!ref' ] )
	var C, R = range.s.r /* start in the first row */
	/* walk every column in the range */
	for ( C = range.s.c; C <= range.e.c; ++C )
	{
		var cell = sheet[ xlsx.utils.encode_cell( { c: C, r: R } ) ] /* find the cell in the first row */

		var hdr = "UNKNOWN " + C // <-- replace with your desired default
		if ( cell && cell.t ) hdr = xlsx.utils.format_cell( cell )

		headers.push( hdr )
	}

	return headers
}

// const sheetNames = importFile.SheetNames.map( x => x.na)
async function copyFile ( srcFile, dstFolder )
{
	try
	{
		if ( fs.existsSync( srcFile ) )
		{
			const dstFile = path.join( dstFolder, path.basename( srcFile ) )
			if ( !fs.existsSync( dstFolder ) )
			{
				fs.mkdirSync( dstFolder )
			}

			fs.copyFileSync( srcFile, dstFile )
			// ncp( srcFile, dstFile )
		}
		return true

	}
	catch ( error ) 
	{
		return false
	}

}
const getConfiguration = function ( args )
{
	var imageColumns = []

	const imageColumnNames = args.imageColumnNames.split( "," )

	return {
		catalogName: args.catalogName,
		catalogBaseFolder: args.catalogBaseFolder,
		imageFolder: `${ catalogBaseFolder }${ args.imageFolder }`,
		imageColumns: args.imageColumnNames.split( ',' ),
		excelFile: `${ catalogBaseFolder }/${ args.catalogName }.xlsm`
	}
}

var imagesToUpload = [
	{
		imageFileName: '',
		imageSource: ''
	}
]

var missingImages = []

const run = async ( args ) =>
{
	const config = getConfiguration( args.arguments )

	var exportInfo = {
		catalogName: '',
		workSheet: '',
		imageColumns: config.imageColumns,
		images: []
	}

	// Read catalog excel file
	var workbook = xlsx.readFile( config.excelFile )

	// Get the sheet names
	workbook.SheetNames.filter( x => !x.match( /-Export/ ) ).map( async ( sheetName ) =>
	{
		// Get the worksheet
		var sheet = workbook.Sheets[ sheetName ]

		// Get the headers
		var headers = getHeader( sheet )

		const imageColumn = headers.indexOf( 'Image 1' )

		excelData = xlsx.utils.sheet_to_json( sheet, { raw: true, blankrows: false } ).filter( element => element[ 'Image 1' ] ).map( element => element[ 'Image 1' ] )

		// Check if folder exists in shopifyImageUploadFolder for the catalog
		const catalogFolder = path.join( shopifyImageUploadFolder, sheetName )
		// if ( !fs.existsSync( catalogFolder ) )
		// {
		// 	fs.mkdirSync( catalogFolder )
		// }

		// Check if the sheet image list exists
		if ( fs.existsSync( `${ shopifyImageUploadFolder }/${ sheetName }.json}` ) )
		{
			// Delete the file
			fs.unlinkSync( `${ shopifyImageUploadFolder }/${ sheetName }.json}` )
		}


		// Create a new json file from the image list
		fs.writeFileSync( `${ shopifyImageUploadFolder }/${ sheetName }.json`, JSON.stringify( excelData ) )

	} )

	const jsonFileList = fs.readdirSync( `${ shopifyImageUploadFolder }` )

	jsonFileList.filter( x => x.match( '.json' ) ).map( async ( sheetName ) =>
	{
		console.log( 'Begin Processing sheets: ' )

		const catalogFolder = `${ shopifyImageUploadFolder }/${ sheetName }`

		await outerLoop( catalogFolder, sheetName )

		console.log( 'End Processing sheets: ' )
	} )

	console.log( `Total Images Missing: ${ missingImages.length }` )
	console.log( `Missing Images: ${ missingImages }` )

	console.log( `Total Images to Upload: ${ imagesToUpload.length }` )
	console.log( `Images to upload: ${ JSON.stringify( imagesToUpload ) }` )
}

const outerLoop = async ( catalogFolder, sheetName ) =>
{
	// Read the json file
	const json = JSON.parse( fs.readFileSync( `${ shopifyImageUploadFolder }/${ sheetName }` ) )

	// Iterate through each image in the json file
	for ( var imageIndex = 0; imageIndex < json.length; imageIndex++ )
	{
		// Get the image name
		const imageName = `${ json[ imageIndex ] }`

		// Check if the image exists using the shopify image url and wait for response
		const result = await verifyImage( `${ shopifyImageUrl }${ imageName }` )
		if ( result )
		{
			// Check if the response is not ok
			console.log( 'Image already exist on shopify: ', imageName )
		}
		else
		{
			console.log( 'Image does not exist on shopify: ', `${ imageName }` )

			// check if image exists in master images folder
			if ( fs.existsSync( `${ masterImagesFolder }/${ imageName }` ) )
			{
				console.log( 'Image exist in master images folder: ', imageName )

				// Copy the image to the shopify image folder
				copyFile( `${ masterImagesFolder }/${ imageName }`, `${ shopifyImageUploadFolder }/` )

				// Add image to the images to upload list
				imagesToUpload.push( {
					imageFileName: imageName,
					imageSource: `${ masterImagesFolder }/${ imageName }`
				} )
			}

			else
			{
				missingImages.push( imageName )
			}
		}
	}
}

module.exports = { run: run }
