#! /usr/bin/env node
/*/////////////////////////////////////////////////////////////////////////////
/// @summary Implements the local HTTP server application.
/// @author Russell Klenk (contact@russellklenk.com)
///////////////////////////////////////////////////////////////////////////80*/
var Filesystem  = require('fs');
var Url         = require('url');
var Http        = require('http');
var Mime        = require('mime');
var Path        = require('path');
var Program     = require('commander');

/// Default application configuration values.
var defaults    = {
    /// The name of the application configuration file to load.
    CONFIG_FILENAME     : 'servelocal.json',
    /// The name of the default file; that is, the file returned when
    /// a request is received for the root '/'.
    ROOT_FILE           : 'index.html',
    /// The absolute path of the default root directory of static content.
    ROOT_PATH           : process.cwd(),
    /// The default port number on which the HTTP server will listen.
    LISTEN_PORT         : 80,
    /// A value indicating whether output is written to stdout/stderr.
    SILENT              : false
};

/// Constants and global values used throughout the application module.
var application = {
    /// The name of the application module.
    NAME                : 'servelocal',
    /// The path from which the application was started.
    STARTUP_DIRECTORY   : process.cwd(),
    /// An object defining the pre-digested command-line arguments passed to
    /// the application, not including the node or script name values.
    args                : {}
};

/// Constants defining the application exit codes.
var exit_code   = {
    /// The application exited normally, with no errors.
    SUCCESS             : 0,
    /// The application exited with a generic error.
    ERROR               : 255
};

/// A handy utility function that prevents having to write the same obnoxious
/// code everytime. The typical javascript '||' trick works for strings,
/// arrays and objects, but it doesn't work for booleans or integers, because
/// both 'false' and '0' evaluate as falsey.
/// @param value The value to test.
/// @param theDefault The value to return if @a value is undefined.
/// @return Either @a value or @a theDefault (if @a value is undefined.)
function defaultValue(value, theDefault)
{
    return (value !== undefined) ? value : theDefault;
}

/// Determines whether a particular filesystem entry exists, and whether it
/// represents a file (as opposed to a directory, etc.)
/// @param path The path of the file to check.
/// @return true if @a path specifies an existing file, or false otherwise.
function isExistingFile(path)
{
    try
    {
        var    stat = Filesystem.statSync(path);
        return stat.isFile();
    }
    catch (error)
    {
        return false;
    }
}

/// Determines whether a particular filesystem entry exists, and whether it
/// represents a directory (as opposed to a file, etc.)
/// @param path The path of the directory to check.
/// @return true if @a path specifies an existing directory.
function isExistingDirectory(path)
{
    try
    {
        var    stat = Filesystem.statSync(path);
        return stat.isDirectory();
    }
    catch (error)
    {
        return false;
    }
}

/// Generates an object specifying the default application configuration.
/// @return An object initialized with the default application configuration.
function defaultConfiguration()
{
    var appConfig         = {};
    appConfig.contentRoot = defaults.ROOT_PATH;
    appConfig.defaultFile = defaults.ROOT_FILE;
    appConfig.listenPort  = defaults.LISTEN_PORT;
    appConfig.silent      = defaults.SILENT;
    return appConfig;
}

/// Writes an application configuration object out to a file.
/// @param config An object representing the application configuration to save.
/// @param filename The path of the configuration file to write. Defaults to
/// the file defaults.CONFIG_FILENAME in the current working directory.
/// @param silent Specify true to suppress any warning console output.
function saveConfiguration(config, filename, silent)
{
    try
    {
        config    = config   || defaultConfiguration();
        filename  = filename || defaults.CONFIG_FILENAME;
        var data  = JSON.stringify(config, null, '\t');
        Filesystem.writeFileSync(filename, data +'\n', 'utf8');
    }
    catch (error)
    {
        if (!silent) // @note: this is non-fatal
        {
            console.warn('Warning: Could not save application configuration:');
            console.warn('  with path: '+filename);
            console.warn('  exception: '+error);
            console.warn();
        }
    }
}

/// Attempts to load a configuration file containing application settings. If
/// the file cannot be loaded, the default configuration is returned.
/// @param filename The path of the configuration file to load. Defaults to
/// the file defaults.CONFIG_FILENAME in the current working directory.
/// @param silent Specify true to suppress any warning console output.
/// @return An object containing startup configuration properties.
function loadConfiguration(filename, silent)
{
    try
    {
        filename  = filename || defaults.CONFIG_FILENAME;
        var data  = Filesystem.readFileSync(filename, 'utf8');
        return JSON.parse(data);
    }
    catch (error)
    {
        if (!silent)
        {
            console.warn('Warning: Could not load application configuration:');
            console.warn('  with path: '+filename);
            console.warn('  exception: '+error);
            console.warn('The default application configuration will be used.');
            console.warn();
        }
        return defaultConfiguration();
    }
}

/// Displays an error message and exits.
/// @param error Information about the error that occurred. Error information
/// is printed only if the application is not started in silent mode.
/// @param exitCode The process exit code. The default exit code is '255'.
function programError(error, exitCode, silent)
{
    if (!silent)
    {
        error = error || '(no information)';
        console.error('An error occurred: '+error);
        console.error();
    }
    process.exit(defaultValue(exitCode, exit_code.ERROR));
}

/// Parses command-line options, displays help if necessary and performs any
/// other setup in preparation for program execution.
/// @return An object describing the application configuration.
function programStartup()
{
    // parse the command line, display help, etc. if the command
    // line is invalid, commander.js calls process.exit() for us.
    Program
        .version('1.0.0')
        .option('-r, --root [path]',     'Specify the root path of the static content.', String)
        .option('-f, --file [filename]', 'Specify the filename of the default file.',    String)
        .option('-p, --port [number]',   'Specify the port number on which to listen.',  Number)
        .option('-s, --silent',          'Run in silent mode (no console output).')
        .option('-S, --save-config',     'Save the current application configuration.')
        .parse(process.argv);

    var configPath = Path.join(process.cwd(), defaults.CONFIG_FILENAME);
    var configData = loadConfiguration(configPath, Program.silent);

    // if no configuration file exists in the working directory, always save
    // out the servelocal.json file containing the current configuration.
    if (!isExistingFile(configPath))
    {
        Program.saveConfig = true;
    }

    // fill in unspecified command-line arguments with values
    // from the application configuration configuration file.
    // otherwise, override the config data from the command line.
    if  (Program.root)    configData.contentRoot = Program.root;
    else Program.root   = configData.contentRoot;

    if  (Program.file)    configData.defaultFile = Program.file;
    else Program.file   = configData.defaultFile;

    if  (Program.port)    configData.listenPort  = Program.port;
    else Program.port   = configData.listenPort;

    if  (Program.silent)  configData.silent      = Program.silent;
    else Program.silent = configData.silent;

    // ensure that the content root is an absolute path and
    // that it specifies an existing directory.
    Program.root = Path.resolve(Program.root);
    configData.contentRoot = Program.root;
    if (!isExistingDirectory(Program.root))
    {
        var message = 'Directory not found: '+ Program.root;
        programError(message, exit_code.ERROR, Program.silent);
    }

    // ensure that the default file exists and that it is
    // an absolute path instead of a relative path.
    /*Program.file = Path.join(Program.root, Program.file);
    configData.defaultFile = Program.file;
    if (!isExistingFile(Program.file))
    {
        var message = 'File not found: ' + Program.file;
        programError(message, exit_code.ERROR, Program.silent);
    }*/

    // write out the application configuration if desired, or if none
    // had existed previously, so the user doesn't have to re-type
    // the command line parameters every time they run.
    if (Program.saveConfig)
    {
        saveConfiguration(configData, configPath, Program.silent);
    }

    // print out the application header and echo the current configuration.
    if (!Program.silent)
    {
        console.log('servelocal');
        console.log('Serve static web content on the local host.');
        console.log('Press Ctrl-C at any time to shutdown and exit.')
        console.log();
        console.log('Configuration: ');
        console.log('  Content Root: '+Program.root);
        console.log('  Default File: '+Program.file);
        console.log('  Listening On: '+'http://localhost:'+Program.port);
        console.log();
    }

    // generate an object containing the final command-line arguments:
    application.args = {
        silent       : Program.silent,
        contentRoot  : Program.root,
        defaultFile  : Program.file,
        listenPort   : Program.port,
        unknown      : Program.args
    };
    return application.args;
}

/// Performs a graceful shutdown of the server.
/// @param error An optional error specifying the reason for the shutdown.
function programShutdown(error)
{
    if (!application.args.silent)
    {
        console.log('Server shutting down...');
    }
    if (error) programError(error, exit_code.ERROR, application.args.silent);
    else       process.exit(exit_code.SUCCESS);
}

/// Starts the static file server listening on the local host.
function programExecute()
{
    Http.createServer(function (req, res)
    {
        var uri = Url.parse(req.url).pathname;
        if (uri === '/')
            uri = application.args.defaultFile;

        var filename = Path.join(application.args.contentRoot, uri);
        var mimeType = Mime.lookup(filename);
        Filesystem.exists(filename, function(exists)
        {
            if(!exists)
            {
                res.writeHead(404, {
                    'Content-Type' : 'text/plain'
                });
                res.write('404 Not Found\n');
                res.end();
                return;
            }
            else
            {
                res.writeHead(200, {
                    'Content-Type' : mimeType
                });
                Filesystem.createReadStream(filename).pipe(res);
            }
        });
    }).listen(application.args.listenPort);
}

/// Handle signals from the user and unhandled exceptions.
process.on('SIGINT',  programShutdown);
process.on('SIGTERM', programShutdown);
process.on('uncaughtException',  programShutdown); // reality says this, but...
process.on('unhandledException', programShutdown); // docs say this.

/// Implements the entry point of the application.
function main()
{
    programStartup();
    programExecute();
}

// entry point: call our main function:
main();
