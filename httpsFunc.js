const https = require( "https" )

class HttpsAdapter
{
	constructor ( { hostname, adapter, path, port = 80 } )
	{
		const { headers } = adapter
		this.hostname = hostname
		this.headers = headers
		this.prefix = path
		this._maxRedirects = 3
		this.port = port
	}
	/**
	 * @param {string} path
	 * @param {{ [x: string]: any; }} params
	 */
	__pathAppendingQueryString ( path, params )  
	{
		// Exit early if there's nothing to append
		if ( !( params instanceof Object ) || !Object.keys( params ).length )
		{
			return path
		}
		return `${ path }?${ Object.keys( params )
			.map( function ( key )
			{
				return `${ key }=${ params[ key ] }`
			} )
			.join( "&" ) }`
	}

	__buildRequestOptions ( config )
	{
		const { hostname, headers } = this
		return {
			...config,
			hostname,
			headers,
		}
	}

	/**
	 * @param {string} path
	 */
	__prefixedPath ( path )
	{
		const prefix = _.get( this, "prefix", false )

		if ( !_.isString( prefix ) || _.isEmpty( prefix ) ) return path

		return `/${ _.trim( prefix, "/" ) }/${ _.trimStart( path, "/" ) }`
	}

	__reset ()
	{
		/* Not Currently Used */
	}

	async _raw_request_ ( endpoint, __config )
	{
		var __redirectCount = _.get( __config, "__redirectCount", 0 )
		const aUrl = ParseUrl( endpoint )
		const options = {
			hostname: aUrl.hostname,
			path: `${ aUrl.pathname }${ aUrl.search }`,
			method: "GET",
			headers: this.headers,
			__redirectCount,
		}
		return this.makeRequest( options, {} )
	}

	async __followRedirect ( response, config = {} )
	{
		let __redirectCount = config.__redirectCount || 0

		if ( ++__redirectCount > this._maxRedirects )
		{
			throw "Too Many Redirects"
		}
		let location = response.redirectTo()
		Logger.dev( "[ DEV ] Redirecting To", { location } )
		return this._raw_request_( location, {
			__redirectCount,
		} )
	}

	__logResponse ( options, response )
	{
		const { method, hostname, path } = options
		const url = `https://${ hostname }${ path }`
		if ( response.isError() )
		{
			Logger.http( `Response: ${ response.status() } | ${ method } | ERROR | ${ url }`, { log_type: "HTTPS" } )
			Logger.debug( `\n-------------------- Begin Error Response Body --------------------\n` )
			Logger.debug( `${ response.body }` )
			Logger.debug( `\n--------------------- End Error Response Body---------------------\n` )
		}
		else if ( response.isRedirect() )
		{
			Logger.warn( `Response: ${ response.status() } | ${ method } | REDIRECT | ${ path }`, { log_type: "HTTPS" } )
		}
		else
		{
			Logger.http( `Response: ${ response.status() } | ${ method } | OK | ${ url }`, { log_type: "HTTPS" } )
		}
	}


	async makeRequest ( options, data = {} )
	{
		Logger.debug( `HttpsAdapter->makeRequest:${ JSON.stringify( options ) }` )

		// Double-Negate Object to compare length=0
		const payload = Object.keys( data ).length ? JSON.stringify( data ) : ""

		options.rejectUnauthorized = false
		options.timeout = 5000

		return new Promise( ( resolve, reject ) =>
		{
			const req = https.request( options, ( res ) =>
			{
				var body = ""
				res.on( "data", ( chunk ) =>
				{
					body += chunk
				} )
				res.on( "end", async () =>
				{
					const response = new Response( body, res.statusCode, res.headers )

					this.__logResponse( options, response )

					if ( response.isRedirect() )
					{
						var __redirectCount = _.get( options, "__redirectCount", 0 )
						const redirectResponse = await this.__followRedirect( response, {
							__redirectCount,
						} )
						resolve( redirectResponse )
					}

					if ( response.isSuccess() )
					{
						HTTP_STATUS = res.statusCode
						Logger.http( response )
						resolve( response )
					}
					else
					{
						HTTP_STATUS = res.statusCode
						Logger.http( response )
						reject( response )
					}
					this.__reset()
				} )
			} )

			req.on( "error", ( error ) =>
			{
				Logger.log( `HTTP ERROR: ${ JSON.stringify( error ) }` )
				const message = `Request Error https://${ options.hostname }/${ options.path }`
				var response = new Response( JSON.stringify( { message, error } ), 500, {} )
				reject( response )
			} )

			req.write( payload )
			req.end()
		} )
	}

	async __ANY ( method, endpoint, params )
	{
		const options = this.__buildRequestOptions( {
			method: method,
			path: this.__prefixedPath( endpoint ),
		} )
		return this.makeRequest( options, params )
	}

	async get ( endpoint, params )
	{
		Logger.debug( `HttpsAdapter->get:${ endpoint }` )

		const path = this.__pathAppendingQueryString( endpoint, params )
		return this.__ANY( "GET", path )
	}

	async post ( endpoint, params )
	{
		Logger.debug( `HttpsAdapter->post:${ endpoint }` )

		return this.__ANY( "POST", endpoint, params )
	}

	async put ( endpoint, params )
	{
		Logger.debug( `HttpsAdapter->put:${ endpoint }` )

		return this.__ANY( "PUT", endpoint, params )
	}

	async delete ( endpoint, params )
	{
		Logger.debug( `HttpsAdapter->delete:${ endpoint }` )

		return this.__ANY( "DELETE", endpoint, params )
	}
}
