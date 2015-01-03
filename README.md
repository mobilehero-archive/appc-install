# Appcelerator Installer [![Build Status](https://travis-ci.org/appcelerator/appc-install.svg?branch=master)](https://travis-ci.org/appcelerator/appc-install)

This is the installer for the Appcelerator Platform software stack.

## Installation

Install globally using npm such as:

```bash
$ sudo npm install appc-install -g
```

Once installed, you should run setup such as:

```bash
$ appc setup
```

This will install the latest version of the Appcelerator Platform tooling.  Once installed, you can then run the various commands.  To get a valid list of commands, run help:

```bash
$ appc help
```

## Switching Versions

By default, the latest downloaded version will be used.  You can switch to a newer or older version with the use command:

```bash
$ appc use 1.2.0
```

This will switch the active version to 1.2.0.  If you don't have this version installed locally, it will fetch this version and download it.

To get a list of all the available versions for download:

```bash
$ appc use

The following versions are available:

0.0.97     Installed (Latest) (Active)              Sat Dec 27 2014 22:37:03 GMT-0800 (PST)
0.0.96     Installed                                Sat Dec 27 2014 17:32:16 GMT-0800 (PST)
```

## Legal

Copyright (c) 2014 by Appcelerator, Inc. All Rights Reserved.  This software is licensed under the Apache 2 Public License.  However, usage of the software to access the Appcelerator Platform is governed by the Appcelerator Enterprise Software License Agreement.
