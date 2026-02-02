warning: in the working copy of 'functions/index.js', CRLF will be replaced by LF the next time Git touches it
warning: in the working copy of 'functions/package-lock.json', CRLF will be replaced by LF the next time Git touches it
warning: in the working copy of 'functions/package.json', CRLF will be replaced by LF the next time Git touches it
[1mdiff --git a/functions/index.js b/functions/index.js[m
[1mindex ed53ac2..0ab838b 100644[m
[1m--- a/functions/index.js[m
[1m+++ b/functions/index.js[m
[36m@@ -1,5 +1,5 @@[m
 /* functions/index.js */[m
[31m-const functions = require("firebase-functions");[m
[32m+[m[32mconst functions = require("firebase-functions/v1");[m
 const admin = require("firebase-admin");[m
 const crypto = require("crypto");[m
 const ALLOWED_ORIGINS = (process.env.ALLOWED_CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")[m
[36m@@ -909,3 +909,4 @@[m [mexports.setFirstAdmin = functions[m
   .https.onRequest((req, res) => {[m
     res.status(410).send("setFirstAdmin disabled");[m
   });[m
[41m+[m
[1mdiff --git a/functions/package-lock.json b/functions/package-lock.json[m
[1mindex ca81c82..55aba90 100644[m
[1m--- a/functions/package-lock.json[m
[1m+++ b/functions/package-lock.json[m
[36m@@ -1,22 +1,62 @@[m
 {[m
[31m-  "name": "functions",[m
[32m+[m[32m  "name": "boots-pos-gemini-functions",[m
   "lockfileVersion": 3,[m
   "requires": true,[m
   "packages": {[m
     "": {[m
[31m-      "name": "functions",[m
[32m+[m[32m      "name": "boots-pos-gemini-functions",[m
       "dependencies": {[m
[32m+[m[32m        "boots-pos-gemini": "file:..",[m
         "cors": "^2.8.5",[m
[31m-        "firebase-admin": "^12.0.0",[m
[31m-        "firebase-functions": "^5.0.0"[m
[32m+[m[32m        "firebase-admin": "^12.7.0",[m
[32m+[m[32m        "firebase-functions": "^7.0.5"[m
       },[m
       "devDependencies": {[m
[31m-        "eslint": "^8.15.0",[m
[31m-        "eslint-config-google": "^0.14.0",[m
[31m-        "firebase-functions-test": "^3.1.0"[m
[32m+[m[32m        "@eslint/js": "^9.39.2",[m
[32m+[m[32m        "eslint": "^9.39.2",[m
[32m+[m[32m        "firebase-functions-test": "^3.1.0",[m
[32m+[m[32m        "globals": "^17.2.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "20"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "..": {[m
[32m+[m[32m      "name": "boots-pos-gemini",[m
[32m+[m[32m      "version": "0.0.0",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@radix-ui/react-dialog": "^1.1.15",[m
[32m+[m[32m        "@radix-ui/react-slot": "^1.2.4",[m
[32m+[m[32m        "class-variance-authority": "^0.7.1",[m
[32m+[m[32m        "clsx": "^2.1.1",[m
[32m+[m[32m        "firebase": "^12.8.0",[m
[32m+[m[32m        "framer-motion": "^12.29.0",[m
[32m+[m[32m        "lucide-react": "^0.542.0",[m
[32m+[m[32m        "react": "^18.3.1",[m
[32m+[m[32m        "react-dom": "^18.3.1",[m
[32m+[m[32m        "react-hot-toast": "2.6.0",[m
[32m+[m[32m        "react-router-dom": "^7.13.0",[m
[32m+[m[32m        "sonner": "^2.0.7",[m
[32m+[m[32m        "tailwind-merge": "^2.5.2",[m
[32m+[m[32m        "xlsx": "^0.18.5"[m
       },[m
[31m-      "engines": {[m
[31m-        "node": "18"[m
[32m+[m[32m      "devDependencies": {[m
[32m+[m[32m        "@babel/eslint-parser": "^7.28.6",[m
[32m+[m[32m        "@babel/preset-env": "^7.28.6",[m
[32m+[m[32m        "@babel/preset-react": "^7.28.5",[m
[32m+[m[32m        "@eslint/js": "^9.39.2",[m
[32m+[m[32m        "@vitejs/plugin-react": "^4.3.1",[m
[32m+[m[32m        "autoprefixer": "^10.4.20",[m
[32m+[m[32m        "eslint": "^9.39.2",[m
[32m+[m[32m        "eslint-plugin-react": "^7.37.5",[m
[32m+[m[32m        "eslint-plugin-react-hooks": "^7.0.1",[m
[32m+[m[32m        "eslint-plugin-react-refresh": "^0.4.26",[m
[32m+[m[32m        "eslint-plugin-unused-imports": "^4.3.0",[m
[32m+[m[32m        "globals": "^17.1.0",[m
[32m+[m[32m        "postcss": "^8.4.41",[m
[32m+[m[32m        "tailwindcss": "^3.4.10",[m
[32m+[m[32m        "tailwindcss-animate": "^1.0.7",[m
[32m+[m[32m        "vite": "^5.4.21"[m
       }[m
     },[m
     "node_modules/@babel/code-frame": {[m
[36m@@ -616,38 +656,119 @@[m
         "node": "^12.0.0 || ^14.0.0 || >=16.0.0"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@eslint/config-array": {[m
[32m+[m[32m      "version": "0.21.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/config-array/-/config-array-0.21.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-aw1gNayWpdI/jSYVgzN5pL0cfzU02GT3NBpeT/DXbx1/1x7ZKxFPd9bwrzygx/qiwIQiJ1sw/zD8qY/kRvlGHA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@eslint/object-schema": "^2.1.7",[m
[32m+[m[32m        "debug": "^4.3.1",[m
[32m+[m[32m        "minimatch": "^3.1.2"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@eslint/config-helpers": {[m
[32m+[m[32m      "version": "0.4.2",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/config-helpers/-/config-helpers-0.4.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-gBrxN88gOIf3R7ja5K9slwNayVcZgK6SOUORm2uBzTeIEfeVaIhOpCtTox3P6R7o2jLFwLFTLnC7kU/RGcYEgw==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@eslint/core": "^0.17.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@eslint/core": {[m
[32m+[m[32m      "version": "0.17.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/core/-/core-0.17.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-yL/sLrpmtDaFEiUj1osRP4TI2MDz1AddJL+jZ7KSqvBuliN4xqYY54IfdN8qD8Toa6g1iloph1fxQNkjOxrrpQ==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@types/json-schema": "^7.0.15"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/@eslint/eslintrc": {[m
[31m-      "version": "2.1.4",[m
[31m-      "resolved": "https://registry.npmmirror.com/@eslint/eslintrc/-/eslintrc-2.1.4.tgz",[m
[31m-      "integrity": "sha512-269Z39MS6wVJtsoUl10L60WdkhJVdPG24Q4eZTH3nnF6lpvSShEK3wQjDX9JRWAUPvPh7COouPpU9IrqaZFvtQ==",[m
[32m+[m[32m      "version": "3.3.3",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/eslintrc/-/eslintrc-3.3.3.tgz",[m
[32m+[m[32m      "integrity": "sha512-Kr+LPIUVKz2qkx1HAMH8q1q6azbqBAsXJUxBl/ODDuVPX45Z9DfwB8tPjTi6nNZ8BuM3nbJxC5zCAg5elnBUTQ==",[m
       "dev": true,[m
       "license": "MIT",[m
       "dependencies": {[m
         "ajv": "^6.12.4",[m
         "debug": "^4.3.2",[m
[31m-        "espree": "^9.6.0",[m
[31m-        "globals": "^13.19.0",[m
[32m+[m[32m        "espree": "^10.0.1",[m
[32m+[m[32m        "globals": "^14.0.0",[m
         "ignore": "^5.2.0",[m
         "import-fresh": "^3.2.1",[m
[31m-        "js-yaml": "^4.1.0",[m
[32m+[m[32m        "js-yaml": "^4.1.1",[m
         "minimatch": "^3.1.2",[m
         "strip-json-comments": "^3.1.1"[m
       },[m
       "engines": {[m
[31m-        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
       },[m
       "funding": {[m
         "url": "https://opencollective.com/eslint"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@eslint/eslintrc/node_modules/globals": {[m
[32m+[m[32m      "version": "14.0.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/globals/-/globals-14.0.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-oahGvuMGQlPw/ivIYBjVSrWAfWLBeku5tpPE2fOPLi+WHffIWbuh2tCjhyQhTBPMf5E9jDEH4FOmTYgYwbKwtQ==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=18"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://github.com/sponsors/sindresorhus"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/@eslint/js": {[m
[31m-      "version": "8.57.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/@eslint/js/-/js-8.57.1.tgz",[m
[31m-      "integrity": "sha512-d9zaMRSTIKDLhctzH12MtXvJKSSUhaHcjV+2Z+GK+EEY7XKpP5yR4x+N3TAcHTcu963nIr+TMcCb4DBCYX1z6Q==",[m
[32m+[m[32m      "version": "9.39.2",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/js/-/js-9.39.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-q1mjIoW1VX4IvSocvM/vbTiveKC4k9eLrajNEuSsmjymSDEbpGddtpfOoN7YGAqBK3NG+uqo8ia4PDTt8buCYA==",[m
       "dev": true,[m
       "license": "MIT",[m
       "engines": {[m
[31m-        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://eslint.org/donate"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@eslint/object-schema": {[m
[32m+[m[32m      "version": "2.1.7",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/object-schema/-/object-schema-2.1.7.tgz",[m
[32m+[m[32m      "integrity": "sha512-VtAOaymWVfZcmZbp6E2mympDIHvyjXs/12LqWYjVw6qjrfF+VK+fyG33kChz3nnK+SU5/NeHOqrTEHS8sXO3OA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@eslint/plugin-kit": {[m
[32m+[m[32m      "version": "0.4.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@eslint/plugin-kit/-/plugin-kit-0.4.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-43/qtrDUokr7LJqoF2c3+RInu/t4zfrpYdoSDfYyhg52rwLV6TnOvdG4fXm7IkSB3wErkcmJS9iEhjVtOSEjjA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@eslint/core": "^0.17.0",[m
[32m+[m[32m        "levn": "^0.4.1"[m
[32m+[m[32m      },[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
       }[m
     },[m
     "node_modules/@fastify/busboy": {[m
[36m@@ -881,20 +1002,28 @@[m
         "node": ">=6"[m
       }[m
     },[m
[31m-    "node_modules/@humanwhocodes/config-array": {[m
[31m-      "version": "0.13.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/@humanwhocodes/config-array/-/config-array-0.13.0.tgz",[m
[31m-      "integrity": "sha512-DZLEEqFWQFiyK6h5YIeynKx7JlvCYWL0cImfSRXZ9l4Sg2efkFGTuFf6vzXjK1cq6IYkU+Eg/JizXw+TD2vRNw==",[m
[31m-      "deprecated": "Use @eslint/config-array instead",[m
[32m+[m[32m    "node_modules/@humanfs/core": {[m
[32m+[m[32m      "version": "0.19.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@humanfs/core/-/core-0.19.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=18.18.0"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@humanfs/node": {[m
[32m+[m[32m      "version": "0.16.7",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@humanfs/node/-/node-0.16.7.tgz",[m
[32m+[m[32m      "integrity": "sha512-/zUx+yOsIrG4Y43Eh2peDeKCxlRt/gET6aHfaKpuq267qXdYDFViVHfMaLyygZOnl0kGWxFIgsBy8QFuTLUXEQ==",[m
       "dev": true,[m
       "license": "Apache-2.0",[m
       "dependencies": {[m
[31m-        "@humanwhocodes/object-schema": "^2.0.3",[m
[31m-        "debug": "^4.3.1",[m
[31m-        "minimatch": "^3.0.5"[m
[32m+[m[32m        "@humanfs/core": "^0.19.1",[m
[32m+[m[32m        "@humanwhocodes/retry": "^0.4.0"[m
       },[m
       "engines": {[m
[31m-        "node": ">=10.10.0"[m
[32m+[m[32m        "node": ">=18.18.0"[m
       }[m
     },[m
     "node_modules/@humanwhocodes/module-importer": {[m
[36m@@ -911,13 +1040,19 @@[m
         "url": "https://github.com/sponsors/nzakas"[m
       }[m
     },[m
[31m-    "node_modules/@humanwhocodes/object-schema": {[m
[31m-      "version": "2.0.3",[m
[31m-      "resolved": "https://registry.npmmirror.com/@humanwhocodes/object-schema/-/object-schema-2.0.3.tgz",[m
[31m-      "integrity": "sha512-93zYdMES/c1D69yZiKDBj0V24vqNzB/koF26KPaagAfd3P/4gUlh3Dys5ogAK+Exi9QyzlD8x/08Zt7wIKcDcA==",[m
[31m-      "deprecated": "Use @eslint/object-schema instead",[m
[32m+[m[32m    "node_modules/@humanwhocodes/retry": {[m
[32m+[m[32m      "version": "0.4.3",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@humanwhocodes/retry/-/retry-0.4.3.tgz",[m
[32m+[m[32m      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",[m
       "dev": true,[m
[31m-      "license": "BSD-3-Clause"[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": ">=18.18"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "type": "github",[m
[32m+[m[32m        "url": "https://github.com/sponsors/nzakas"[m
[32m+[m[32m      }[m
     },[m
     "node_modules/@isaacs/cliui": {[m
       "version": "8.0.2",[m
[36m@@ -1535,44 +1670,6 @@[m
         "@tybys/wasm-util": "^0.10.0"[m
       }[m
     },[m
[31m-    "node_modules/@nodelib/fs.scandir": {[m
[31m-      "version": "2.1.5",[m
[31m-      "resolved": "https://registry.npmmirror.com/@nodelib/fs.scandir/-/fs.scandir-2.1.5.tgz",[m
[31m-      "integrity": "sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "@nodelib/fs.stat": "2.0.5",[m
[31m-        "run-parallel": "^1.1.9"[m
[31m-      },[m
[31m-      "engines": {[m
[31m-        "node": ">= 8"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/@nodelib/fs.stat": {[m
[31m-      "version": "2.0.5",[m
[31m-      "resolved": "https://registry.npmmirror.com/@nodelib/fs.stat/-/fs.stat-2.0.5.tgz",[m
[31m-      "integrity": "sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT",[m
[31m-      "engines": {[m
[31m-        "node": ">= 8"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/@nodelib/fs.walk": {[m
[31m-      "version": "1.2.8",[m
[31m-      "resolved": "https://registry.npmmirror.com/@nodelib/fs.walk/-/fs.walk-1.2.8.tgz",[m
[31m-      "integrity": "sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "@nodelib/fs.scandir": "2.1.5",[m
[31m-        "fastq": "^1.6.0"[m
[31m-      },[m
[31m-      "engines": {[m
[31m-        "node": ">= 8"[m
[31m-      }[m
[31m-    },[m
     "node_modules/@opentelemetry/api": {[m
       "version": "1.9.0",[m
       "resolved": "https://registry.npmmirror.com/@opentelemetry/api/-/api-1.9.0.tgz",[m
[36m@@ -1809,21 +1906,29 @@[m
         "@types/node": "*"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@types/estree": {[m
[32m+[m[32m      "version": "1.0.8",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/estree/-/estree-1.0.8.tgz",[m
[32m+[m[32m      "integrity": "sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/@types/express": {[m
[31m-      "version": "4.17.3",[m
[31m-      "resolved": "https://registry.npmmirror.com/@types/express/-/express-4.17.3.tgz",[m
[31m-      "integrity": "sha512-I8cGRJj3pyOLs/HndoP+25vOqhqWkAZsWMEmq1qXy/b/M3ppufecUwaK2/TVDVxcV61/iSdhykUjQQ2DLSrTdg==",[m
[32m+[m[32m      "version": "4.17.25",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/express/-/express-4.17.25.tgz",[m
[32m+[m[32m      "integrity": "sha512-dVd04UKsfpINUnK0yBoYHDF3xu7xVH4BuDotC/xGuycx4CgbP48X/KF/586bcObxT0HENHXEU8Nqtu6NR+eKhw==",[m
       "license": "MIT",[m
       "dependencies": {[m
         "@types/body-parser": "*",[m
[31m-        "@types/express-serve-static-core": "*",[m
[31m-        "@types/serve-static": "*"[m
[32m+[m[32m        "@types/express-serve-static-core": "^4.17.33",[m
[32m+[m[32m        "@types/qs": "*",[m
[32m+[m[32m        "@types/serve-static": "^1"[m
       }[m
     },[m
     "node_modules/@types/express-serve-static-core": {[m
[31m-      "version": "5.1.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/@types/express-serve-static-core/-/express-serve-static-core-5.1.1.tgz",[m
[31m-      "integrity": "sha512-v4zIMr/cX7/d2BpAEX3KNKL/JrT1s43s96lLvvdTmza1oEvDudCqK9aF/djc/SWgy8Yh0h30TZx5VpzqFCxk5A==",[m
[32m+[m[32m      "version": "4.19.8",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/express-serve-static-core/-/express-serve-static-core-4.19.8.tgz",[m
[32m+[m[32m      "integrity": "sha512-02S5fmqeoKzVZCHPZid4b8JH2eM5HzQLZWN2FohQEy/0eXTq8VXZfSN6Pcr3F6N9R/vNrj7cpgbhjie6m/1tCA==",[m
       "license": "MIT",[m
       "dependencies": {[m
         "@types/node": "*",[m
[36m@@ -1868,6 +1973,13 @@[m
         "@types/istanbul-lib-report": "*"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/@types/json-schema": {[m
[32m+[m[32m      "version": "7.0.15",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/json-schema/-/json-schema-7.0.15.tgz",[m
[32m+[m[32m      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/@types/jsonwebtoken": {[m
       "version": "9.0.10",[m
       "resolved": "https://registry.npmmirror.com/@types/jsonwebtoken/-/jsonwebtoken-9.0.10.tgz",[m
[36m@@ -1892,6 +2004,12 @@[m
       "license": "MIT",[m
       "optional": true[m
     },[m
[32m+[m[32m    "node_modules/@types/mime": {[m
[32m+[m[32m      "version": "1.3.5",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/mime/-/mime-1.3.5.tgz",[m
[32m+[m[32m      "integrity": "sha512-/pyBZWSLD2n0dcHE3hq8s8ZvcETHtEuF+3E7XVt0Ig2nvsVQXdghHVcEkIWjy9A0wKfTn97a/PSDYohKIlnP/w==",[m
[32m+[m[32m      "license": "MIT"[m
[32m+[m[32m    },[m
     "node_modules/@types/ms": {[m
       "version": "2.1.0",[m
       "resolved": "https://registry.npmmirror.com/@types/ms/-/ms-2.1.0.tgz",[m
[36m@@ -1942,12 +2060,23 @@[m
       }[m
     },[m
     "node_modules/@types/serve-static": {[m
[31m-      "version": "2.2.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/@types/serve-static/-/serve-static-2.2.0.tgz",[m
[31m-      "integrity": "sha512-8mam4H1NHLtu7nmtalF7eyBH14QyOASmcxHhSfEoRyr0nP/YdoesEtU+uSRvMe96TW/HPTtkoKqQLl53N7UXMQ==",[m
[32m+[m[32m      "version": "1.15.10",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/serve-static/-/serve-static-1.15.10.tgz",[m
[32m+[m[32m      "integrity": "sha512-tRs1dB+g8Itk72rlSI2ZrW6vZg0YrLI81iQSTkMmOqnqCaNr/8Ek4VwWcN5vZgCYWbg/JJSGBlUaYGAOP73qBw==",[m
       "license": "MIT",[m
       "dependencies": {[m
         "@types/http-errors": "*",[m
[32m+[m[32m        "@types/node": "*",[m
[32m+[m[32m        "@types/send": "<1"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/@types/serve-static/node_modules/@types/send": {[m
[32m+[m[32m      "version": "0.17.6",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/@types/send/-/send-0.17.6.tgz",[m
[32m+[m[32m      "integrity": "sha512-Uqt8rPBE8SY0RK8JB1EzVOIZ32uqy8HwdxCnoCOsYrvnswqmFZ/k+9Ikidlk/ImhsdvBsloHbAlewb2IEBV/Og==",[m
[32m+[m[32m      "license": "MIT",[m
[32m+[m[32m      "dependencies": {[m
[32m+[m[32m        "@types/mime": "^1",[m
         "@types/node": "*"[m
       }[m
     },[m
[36m@@ -1990,7 +2119,8 @@[m
       "resolved": "https://registry.npmmirror.com/@ungap/structured-clone/-/structured-clone-1.3.0.tgz",[m
       "integrity": "sha512-WmoN8qaIAo7WTYWbAZuG8PYEhn5fkz7dZrqTBZ7dtt//lL2Gwms1IcnQ5yHqjDfX8Ft5j4YzDM23f87zBfDe9g==",[m
       "dev": true,[m
[31m-      "license": "ISC"[m
[32m+[m[32m      "license": "ISC",[m
[32m+[m[32m      "peer": true[m
     },[m
     "node_modules/@unrs/resolver-binding-android-arm-eabi": {[m
       "version": "1.11.1",[m
[36m@@ -2660,6 +2790,10 @@[m
       "integrity": "sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==",[m
       "license": "MIT"[m
     },[m
[32m+[m[32m    "node_modules/boots-pos-gemini": {[m
[32m+[m[32m      "resolved": "..",[m
[32m+[m[32m      "link": true[m
[32m+[m[32m    },[m
     "node_modules/brace-expansion": {[m
       "version": "1.1.12",[m
       "resolved": "https://registry.npmmirror.com/brace-expansion/-/brace-expansion-1.1.12.tgz",[m
[36m@@ -3161,19 +3295,6 @@[m
         "node": ">=8"[m
       }[m
     },[m
[31m-    "node_modules/doctrine": {[m
[31m-      "version": "3.0.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/doctrine/-/doctrine-3.0.0.tgz",[m
[31m-      "integrity": "sha512-yS+Q5i3hBf7GBkd4KG8a7eBNNWNGLTaEwwYWUijIYM7zrlYDM0BFXHjjPWlWZ1Rg7UaddZeIDmi9jF3HmqiQ2w==",[m
[31m-      "dev": true,[m
[31m-      "license": "Apache-2.0",[m
[31m-      "dependencies": {[m
[31m-        "esutils": "^2.0.2"[m
[31m-      },[m
[31m-      "engines": {[m
[31m-        "node": ">=6.0.0"[m
[31m-      }[m
[31m-    },[m
     "node_modules/dunder-proto": {[m
       "version": "1.0.1",[m
       "resolved": "https://registry.npmmirror.com/dunder-proto/-/dunder-proto-1.0.1.tgz",[m
[36m@@ -3360,79 +3481,69 @@[m
       }[m
     },[m
     "node_modules/eslint": {[m
[31m-      "version": "8.57.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/eslint/-/eslint-8.57.1.tgz",[m
[31m-      "integrity": "sha512-ypowyDxpVSYpkXr9WPv2PAZCtNip1Mv5KTW0SCurXv/9iOpcrH9PaqUElksqEB6pChqHGDRCFTyrZlGhnLNGiA==",[m
[31m-      "deprecated": "This version is no longer supported. Please see https://eslint.org/version-support for other options.",[m
[32m+[m[32m      "version": "9.39.2",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/eslint/-/eslint-9.39.2.tgz",[m
[32m+[m[32m      "integrity": "sha512-LEyamqS7W5HB3ujJyvi0HQK/dtVINZvd5mAAp9eT5S/ujByGjiZLCzPcHVzuXbpJDJF/cxwHlfceVUDZ2lnSTw==",[m
       "dev": true,[m
       "license": "MIT",[m
       "dependencies": {[m
[31m-        "@eslint-community/eslint-utils": "^4.2.0",[m
[31m-        "@eslint-community/regexpp": "^4.6.1",[m
[31m-        "@eslint/eslintrc": "^2.1.4",[m
[31m-        "@eslint/js": "8.57.1",[m
[31m-        "@humanwhocodes/config-array": "^0.13.0",[m
[32m+[m[32m        "@eslint-community/eslint-utils": "^4.8.0",[m
[32m+[m[32m        "@eslint-community/regexpp": "^4.12.1",[m
[32m+[m[32m        "@eslint/config-array": "^0.21.1",[m
[32m+[m[32m        "@eslint/config-helpers": "^0.4.2",[m
[32m+[m[32m        "@eslint/core": "^0.17.0",[m
[32m+[m[32m        "@eslint/eslintrc": "^3.3.1",[m
[32m+[m[32m        "@eslint/js": "9.39.2",[m
[32m+[m[32m        "@eslint/plugin-kit": "^0.4.1",[m
[32m+[m[32m        "@humanfs/node": "^0.16.6",[m
         "@humanwhocodes/module-importer": "^1.0.1",[m
[31m-        "@nodelib/fs.walk": "^1.2.8",[m
[31m-        "@ungap/structured-clone": "^1.2.0",[m
[32m+[m[32m        "@humanwhocodes/retry": "^0.4.2",[m
[32m+[m[32m        "@types/estree": "^1.0.6",[m
         "ajv": "^6.12.4",[m
         "chalk": "^4.0.0",[m
[31m-        "cross-spawn": "^7.0.2",[m
[32m+[m[32m        "cross-spawn": "^7.0.6",[m
         "debug": "^4.3.2",[m
[31m-        "doctrine": "^3.0.0",[m
         "escape-string-regexp": "^4.0.0",[m
[31m-        "eslint-scope": "^7.2.2",[m
[31m-        "eslint-visitor-keys": "^3.4.3",[m
[31m-        "espree": "^9.6.1",[m
[31m-        "esquery": "^1.4.2",[m
[32m+[m[32m        "eslint-scope": "^8.4.0",[m
[32m+[m[32m        "eslint-visitor-keys": "^4.2.1",[m
[32m+[m[32m        "espree": "^10.4.0",[m
[32m+[m[32m        "esquery": "^1.5.0",[m
         "esutils": "^2.0.2",[m
         "fast-deep-equal": "^3.1.3",[m
[31m-        "file-entry-cache": "^6.0.1",[m
[32m+[m[32m        "file-entry-cache": "^8.0.0",[m
         "find-up": "^5.0.0",[m
         "glob-parent": "^6.0.2",[m
[31m-        "globals": "^13.19.0",[m
[31m-        "graphemer": "^1.4.0",[m
         "ignore": "^5.2.0",[m
         "imurmurhash": "^0.1.4",[m
         "is-glob": "^4.0.0",[m
[31m-        "is-path-inside": "^3.0.3",[m
[31m-        "js-yaml": "^4.1.0",[m
         "json-stable-stringify-without-jsonify": "^1.0.1",[m
[31m-        "levn": "^0.4.1",[m
         "lodash.merge": "^4.6.2",[m
         "minimatch": "^3.1.2",[m
         "natural-compare": "^1.4.0",[m
[31m-        "optionator": "^0.9.3",[m
[31m-        "strip-ansi": "^6.0.1",[m
[31m-        "text-table": "^0.2.0"[m
[32m+[m[32m        "optionator": "^0.9.3"[m
       },[m
       "bin": {[m
         "eslint": "bin/eslint.js"[m
       },[m
       "engines": {[m
[31m-        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
       },[m
       "funding": {[m
[31m-        "url": "https://opencollective.com/eslint"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/eslint-config-google": {[m
[31m-      "version": "0.14.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/eslint-config-google/-/eslint-config-google-0.14.0.tgz",[m
[31m-      "integrity": "sha512-WsbX4WbjuMvTdeVL6+J3rK1RGhCTqjsFjX7UMSMgZiyxxaNLkoJENbrGExzERFeoTpGw3F3FypTiWAP9ZXzkEw==",[m
[31m-      "dev": true,[m
[31m-      "license": "Apache-2.0",[m
[31m-      "engines": {[m
[31m-        "node": ">=0.10.0"[m
[32m+[m[32m        "url": "https://eslint.org/donate"[m
       },[m
       "peerDependencies": {[m
[31m-        "eslint": ">=5.16.0"[m
[32m+[m[32m        "jiti": "*"[m
[32m+[m[32m      },[m
[32m+[m[32m      "peerDependenciesMeta": {[m
[32m+[m[32m        "jiti": {[m
[32m+[m[32m          "optional": true[m
[32m+[m[32m        }[m
       }[m
     },[m
     "node_modules/eslint-scope": {[m
[31m-      "version": "7.2.2",[m
[31m-      "resolved": "https://registry.npmmirror.com/eslint-scope/-/eslint-scope-7.2.2.tgz",[m
[31m-      "integrity": "sha512-dOt21O7lTMhDM+X9mB4GX+DZrZtCUJPL/wlcTqxyrx5IvO0IYtILdtrQGQp+8n5S0gwSVmOf9NQrjMOgfQZlIg==",[m
[32m+[m[32m      "version": "8.4.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/eslint-scope/-/eslint-scope-8.4.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg==",[m
       "dev": true,[m
       "license": "BSD-2-Clause",[m
       "dependencies": {[m
[36m@@ -3440,7 +3551,7 @@[m
         "estraverse": "^5.2.0"[m
       },[m
       "engines": {[m
[31m-        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
       },[m
       "funding": {[m
         "url": "https://opencollective.com/eslint"[m
[36m@@ -3459,19 +3570,45 @@[m
         "url": "https://opencollective.com/eslint"[m
       }[m
     },[m
[32m+[m[32m    "node_modules/eslint/node_modules/eslint-visitor-keys": {[m
[32m+[m[32m      "version": "4.2.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/eslint-visitor-keys/-/eslint-visitor-keys-4.2.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://opencollective.com/eslint"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
     "node_modules/espree": {[m
[31m-      "version": "9.6.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/espree/-/espree-9.6.1.tgz",[m
[31m-      "integrity": "sha512-oruZaFkjorTpF32kDSI5/75ViwGeZginGGy2NoOSg3Q9bnwlnmDm4HLnkl0RE3n+njDXR037aY1+x58Z/zFdwQ==",[m
[32m+[m[32m      "version": "10.4.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/espree/-/espree-10.4.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-j6PAQ2uUr79PZhBjP5C5fhl8e39FmRnOjsD5lGnWrFU8i2G776tBK7+nP8KuQUTTyAZUwfQqXAgrVH5MbH9CYQ==",[m
       "dev": true,[m
       "license": "BSD-2-Clause",[m
       "dependencies": {[m
[31m-        "acorn": "^8.9.0",[m
[32m+[m[32m        "acorn": "^8.15.0",[m
         "acorn-jsx": "^5.3.2",[m
[31m-        "eslint-visitor-keys": "^3.4.1"[m
[32m+[m[32m        "eslint-visitor-keys": "^4.2.1"[m
       },[m
       "engines": {[m
[31m-        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "funding": {[m
[32m+[m[32m        "url": "https://opencollective.com/eslint"[m
[32m+[m[32m      }[m
[32m+[m[32m    },[m
[32m+[m[32m    "node_modules/espree/node_modules/eslint-visitor-keys": {[m
[32m+[m[32m      "version": "4.2.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/eslint-visitor-keys/-/eslint-visitor-keys-4.2.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==",[m
[32m+[m[32m      "dev": true,[m
[32m+[m[32m      "license": "Apache-2.0",[m
[32m+[m[32m      "engines": {[m
[32m+[m[32m        "node": "^18.18.0 || ^20.9.0 || >=21.1.0"[m
       },[m
       "funding": {[m
         "url": "https://opencollective.com/eslint"[m
[36m@@ -3737,16 +3874,6 @@[m
         "fxparser": "src/cli/cli.js"[m
       }[m
     },[m
[31m-    "node_modules/fastq": {[m
[31m-      "version": "1.20.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/fastq/-/fastq-1.20.1.tgz",[m
[31m-      "integrity": "sha512-GGToxJ/w1x32s/D2EKND7kTil4n8OVk/9mycTc4VDza13lOvpUZTGX3mFSCtV9ksdGBVzvsyAVLM6mHFThxXxw==",[m
[31m-      "dev": true,[m
[31m-      "license": "ISC",[m
[31m-      "dependencies": {[m
[31m-        "reusify": "^1.0.4"[m
[31m-      }[m
[31m-    },[m
     "node_modules/faye-websocket": {[m
       "version": "0.11.4",[m
       "resolved": "https://registry.npmmirror.com/faye-websocket/-/faye-websocket-0.11.4.tgz",[m
[36m@@ -3771,16 +3898,16 @@[m
       }[m
     },[m
     "node_modules/file-entry-cache": {[m
[31m-      "version": "6.0.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/file-entry-cache/-/file-entry-cache-6.0.1.tgz",[m
[31m-      "integrity": "sha512-7Gps/XWymbLk2QLYK4NzpMOrYjMhdIxXuIvy2QBsLE6ljuodKvdkWs/cpyJJ3CVIVpH0Oi1Hvg1ovbMzLdFBBg==",[m
[32m+[m[32m      "version": "8.0.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/file-entry-cache/-/file-entry-cache-8.0.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-XXTUwCvisa5oacNGRP9SfNtYBNAMi+RPwBFmblZEF7N7swHYQS6/Zfk7SRwx4D5j3CH211YNRco1DEMNVfZCnQ==",[m
       "dev": true,[m
       "license": "MIT",[m
       "dependencies": {[m
[31m-        "flat-cache": "^3.0.4"[m
[32m+[m[32m        "flat-cache": "^4.0.0"[m
       },[m
       "engines": {[m
[31m-        "node": "^10.12.0 || >=12.0.0"[m
[32m+[m[32m        "node": ">=16.0.0"[m
       }[m
     },[m
     "node_modules/fill-range": {[m
[36m@@ -3872,25 +3999,39 @@[m
       }[m
     },[m
     "node_modules/firebase-functions": {[m
[31m-      "version": "5.1.1",[m
[31m-      "resolved": "https://registry.npmmirror.com/firebase-functions/-/firebase-functions-5.1.1.tgz",[m
[31m-      "integrity": "sha512-KkyKZE98Leg/C73oRyuUYox04PQeeBThdygMfeX+7t1cmKWYKa/ZieYa89U8GHgED+0mF7m7wfNZOfbURYxIKg==",[m
[32m+[m[32m      "version": "7.0.5",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/firebase-functions/-/firebase-functions-7.0.5.tgz",[m
[32m+[m[32m      "integrity": "sha512-uG2dR5AObLuUrWWjj/de5XxNHCVi+Ehths0DSRcLjHJdgw1TSejwoZZ5na6gVrl3znNjRdBRy5Br5UlhaIU3Ww==",[m
       "license": "MIT",[m
       "dependencies": {[m
         "@types/cors": "^2.8.5",[m
[31m-        "@types/express": "4.17.3",[m
[32m+[m[32m        "@types/express": "^4.17.21",[m
         "cors": "^2.8.5",[m
[31m-        "express": "^4.17.1",[m
[32m+[m[32m        "express": "^4.21.0",[m
         "protobufjs": "^7.2.2"[m
       },[m
       "bin": {[m
         "firebase-functions": "lib/bin/firebase-functions.js"[m
       },[m
       "engines": {[m
[31m-        "node": ">=14.10.0"[m
[32m+[m[32m        "node": ">=18.0.0"[m
       },[m
       "peerDependencies": {[m
[31m-        "firebase-admin": "^11.10.0 || ^12.0.0"[m
[32m+[m[32m        "@apollo/server": "^5.2.0",[m
[32m+[m[32m        "@as-integrations/express4": "^1.1.2",[m
[32m+[m[32m        "firebase-admin": "^11.10.0 || ^12.0.0 || ^13.0.0",[m
[32m+[m[32m        "graphql": "^16.12.0"[m
[32m+[m[32m      },[m
[32m+[m[32m      "peerDependenciesMeta": {[m
[32m+[m[32m        "@apollo/server": {[m
[32m+[m[32m          "optional": true[m
[32m+[m[32m        },[m
[32m+[m[32m        "@as-integrations/express4": {[m
[32m+[m[32m          "optional": true[m
[32m+[m[32m        },[m
[32m+[m[32m        "graphql": {[m
[32m+[m[32m          "optional": true[m
[32m+[m[32m        }[m
       }[m
     },[m
     "node_modules/firebase-functions-test": {[m
[36m@@ -3914,18 +4055,17 @@[m
       }[m
     },[m
     "node_modules/flat-cache": {[m
[31m-      "version": "3.2.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/flat-cache/-/flat-cache-3.2.0.tgz",[m
[31m-      "integrity": "sha512-CYcENa+FtcUKLmhhqyctpclsq7QF38pKjZHsGNiSQF5r4FtoKDWabFDl3hzaEQMvT1LHEysw5twgLvpYYb4vbw==",[m
[32m+[m[32m      "version": "4.0.1",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/flat-cache/-/flat-cache-4.0.1.tgz",[m
[32m+[m[32m      "integrity": "sha512-f7ccFPK3SXFHpx15UIGyRJ/FJQctuKZ0zVuN3frBo4HnK3cay9VEW0R6yPYFHC0AgqhukPzKjq22t5DmAyqGyw==",[m
       "dev": true,[m
       "license": "MIT",[m
       "dependencies": {[m
         "flatted": "^3.2.9",[m
[31m-        "keyv": "^4.5.3",[m
[31m-        "rimraf": "^3.0.2"[m
[32m+[m[32m        "keyv": "^4.5.4"[m
       },[m
       "engines": {[m
[31m-        "node": "^10.12.0 || >=12.0.0"[m
[32m+[m[32m        "node": ">=16"[m
       }[m
     },[m
     "node_modules/flatted": {[m
[36m@@ -3994,7 +4134,8 @@[m
       "resolved": "https://registry.npmmirror.com/fs.realpath/-/fs.realpath-1.0.0.tgz",[m
       "integrity": "sha512-OO0pH2lK6a0hZnAdau5ItzHPI6pUlvI7jMVnxUQRtw4owF2wk8lOSabtGDCTP4Ggrg2MbGnWO9X8K1t4+fGMDw==",[m
       "dev": true,[m
[31m-      "license": "ISC"[m
[32m+[m[32m      "license": "ISC",[m
[32m+[m[32m      "peer": true[m
     },[m
     "node_modules/fsevents": {[m
       "version": "2.3.3",[m
[36m@@ -4221,16 +4362,13 @@[m
       }[m
     },[m
     "node_modules/globals": {[m
[31m-      "version": "13.24.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/globals/-/globals-13.24.0.tgz",[m
[31m-      "integrity": "sha512-AhO5QUcj8llrbG09iWhPU2B204J1xnPeL8kQmVorSsy+Sjj1sk8gIyh6cUocGmH4L0UuhAJy+hJMRA4mgA4mFQ==",[m
[32m+[m[32m      "version": "17.2.0",[m
[32m+[m[32m      "resolved": "https://registry.npmmirror.com/globals/-/globals-17.2.0.tgz",[m
[32m+[m[32m      "integrity": "sha512-tovnCz/fEq+Ripoq+p/gN1u7l6A7wwkoBT9pRCzTHzsD/LvADIzXZdjmRymh5Ztf0DYC3Rwg5cZRYjxzBmzbWg==",[m
       "dev": true,[m
       "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "type-fest": "^0.20.2"[m
[31m-      },[m
       "engines": {[m
[31m-        "node": ">=8"[m
[32m+[m[32m        "node": ">=18"[m
       },[m
       "funding": {[m
         "url": "https://github.com/sponsors/sindresorhus"[m
[36m@@ -4322,13 +4460,6 @@[m
       "license": "ISC",[m
       "peer": true[m
     },[m
[31m-    "node_modules/graphemer": {[m
[31m-      "version": "1.4.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/graphemer/-/graphemer-1.4.0.tgz",[m
[31m-      "integrity": "sha512-EtKwoO6kxCL9WO5xipiHTZlSzBm7WLT627TqC/uVRd0HKmq8NXyebnNYxDoBi7wt8eTWrUrKXCOVaFq9x1kgag==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT"[m
[31m-    },[m
     "node_modules/gtoken": {[m
       "version": "7.1.0",[m
       "resolved": "https://registry.npmmirror.com/gtoken/-/gtoken-7.1.0.tgz",[m
[36m@@ -4574,6 +4705,7 @@[m
       "deprecated": "This module is not supported, and leaks memory. Do not use it. Check out lru-cache if you want a good and tested way to coalesce async requests by a key value, which is much more comprehensive and powerful.",[m
       "dev": true,[m
       "license": "ISC",[m
[32m+[m[32m      "peer": true,[m
       "dependencies": {[m
         "once": "^1.3.0",[m
         "wrappy": "1"[m
[36m@@ -4657,16 +4789,6 @@[m
         "node": ">=0.12.0"[m
       }[m
     },[m
[31m-    "node_modules/is-path-inside": {[m
[31m-      "version": "3.0.3",[m
[31m-      "resolved": "https://registry.npmmirror.com/is-path-inside/-/is-path-inside-3.0.3.tgz",[m
[31m-      "integrity": "sha512-Fd4gABb+ycGAmKou8eMftCupSir5lRxqf4aD/vd0cD2qc4HL07OjCeuHMr8Ro4CoMaeCKDB0/ECBOVWjTwUvPQ==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT",[m
[31m-      "engines": {[m
[31m-        "node": ">=8"[m
[31m-      }[m
[31m-    },[m
     "node_modules/is-stream": {[m
       "version": "2.0.1",[m
       "resolved": "https://registry.npmmirror.com/is-stream/-/is-stream-2.0.1.tgz",[m
[36m@@ -6252,6 +6374,7 @@[m
       "integrity": "sha512-AVbw3UJ2e9bq64vSaS9Am0fje1Pa8pbGqTTsmXfaIiMpnr5DlDhfJOuLj9Sf95ZPVDAUerDfEk88MPmPe7UCQg==",[m
       "dev": true,[m
       "license": "MIT",[m
[32m+[m[32m      "peer": true,[m
       "engines": {[m
         "node": ">=0.10.0"[m
       }[m
[36m@@ -6538,27 +6661,6 @@[m
         "url": "https://github.com/sponsors/ljharb"[m
       }[m
     },[m
[31m-    "node_modules/queue-microtask": {[m
[31m-      "version": "1.2.3",[m
[31m-      "resolved": "https://registry.npmmirror.com/queue-microtask/-/queue-microtask-1.2.3.tgz",[m
[31m-      "integrity": "sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==",[m
[31m-      "dev": true,[m
[31m-      "funding": [[m
[31m-        {[m
[31m-          "type": "github",[m
[31m-          "url": "https://github.com/sponsors/feross"[m
[31m-        },[m
[31m-        {[m
[31m-          "type": "patreon",[m
[31m-          "url": "https://www.patreon.com/feross"[m
[31m-        },[m
[31m-        {[m
[31m-          "type": "consulting",[m
[31m-          "url": "https://feross.org/support"[m
[31m-        }[m
[31m-      ],[m
[31m-      "license": "MIT"[m
[31m-    },[m
     "node_modules/range-parser": {[m
       "version": "1.2.1",[m
       "resolved": "https://registry.npmmirror.com/range-parser/-/range-parser-1.2.1.tgz",[m
[36m@@ -6676,80 +6778,6 @@[m
         "node": ">=14"[m
       }[m
     },[m
[31m-    "node_modules/reusify": {[m
[31m-      "version": "1.1.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/reusify/-/reusify-1.1.0.tgz",[m
[31m-      "integrity": "sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT",[m
[31m-      "engines": {[m
[31m-        "iojs": ">=1.0.0",[m
[31m-        "node": ">=0.10.0"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/rimraf": {[m
[31m-      "version": "3.0.2",[m
[31m-      "resolved": "https://registry.npmmirror.com/rimraf/-/rimraf-3.0.2.tgz",[m
[31m-      "integrity": "sha512-JZkJMZkAGFFPP2YqXZXPbMlMBgsxzE8ILs4lMIX/2o0L9UBw9O/Y3o6wFw/i9YLapcUJWwqbi3kdxIPdC62TIA==",[m
[31m-      "deprecated": "Rimraf versions prior to v4 are no longer supported",[m
[31m-      "dev": true,[m
[31m-      "license": "ISC",[m
[31m-      "dependencies": {[m
[31m-        "glob": "^7.1.3"[m
[31m-      },[m
[31m-      "bin": {[m
[31m-        "rimraf": "bin.js"[m
[31m-      },[m
[31m-      "funding": {[m
[31m-        "url": "https://github.com/sponsors/isaacs"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/rimraf/node_modules/glob": {[m
[31m-      "version": "7.2.3",[m
[31m-      "resolved": "https://registry.npmmirror.com/glob/-/glob-7.2.3.tgz",[m
[31m-      "integrity": "sha512-nFR0zLpU2YCaRxwoCJvL6UvCH2JFyFVIvwTLsIf21AuHlMskA1hhTdk+LlYJtOlYt9v6dvszD2BGRqBL+iQK9Q==",[m
[31m-      "deprecated": "Glob versions prior to v9 are no longer supported",[m
[31m-      "dev": true,[m
[31m-      "license": "ISC",[m
[31m-      "dependencies": {[m
[31m-        "fs.realpath": "^1.0.0",[m
[31m-        "inflight": "^1.0.4",[m
[31m-        "inherits": "2",[m
[31m-        "minimatch": "^3.1.1",[m
[31m-        "once": "^1.3.0",[m
[31m-        "path-is-absolute": "^1.0.0"[m
[31m-      },[m
[31m-      "engines": {[m
[31m-        "node": "*"[m
[31m-      },[m
[31m-      "funding": {[m
[31m-        "url": "https://github.com/sponsors/isaacs"[m
[31m-      }[m
[31m-    },[m
[31m-    "node_modules/run-parallel": {[m
[31m-      "version": "1.2.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/run-parallel/-/run-parallel-1.2.0.tgz",[m
[31m-      "integrity": "sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==",[m
[31m-      "dev": true,[m
[31m-      "funding": [[m
[31m-        {[m
[31m-          "type": "github",[m
[31m-          "url": "https://github.com/sponsors/feross"[m
[31m-        },[m
[31m-        {[m
[31m-          "type": "patreon",[m
[31m-          "url": "https://www.patreon.com/feross"[m
[31m-        },[m
[31m-        {[m
[31m-          "type": "consulting",[m
[31m-          "url": "https://feross.org/support"[m
[31m-        }[m
[31m-      ],[m
[31m-      "license": "MIT",[m
[31m-      "dependencies": {[m
[31m-        "queue-microtask": "^1.2.2"[m
[31m-      }[m
[31m-    },[m
     "node_modules/safe-buffer": {[m
       "version": "5.2.1",[m
       "resolved": "https://registry.npmmirror.com/safe-buffer/-/safe-buffer-5.2.1.tgz",[m
[36m@@ -7371,13 +7399,6 @@[m
         "url": "https://github.com/sponsors/isaacs"[m
       }[m
     },[m
[31m-    "node_modules/text-table": {[m
[31m-      "version": "0.2.0",[m
[31m-      "resolved": "https://registry.npmmirror.com/text-table/-/text-table-0.2.0.tgz",[m
[31m-      "integrity": "sha512-N+8UisAXDGk8PFXP4HAzVR9nbfmVJ3zYLAWiTIoqC5v5isinhr+r5uaO8+7r3BMfuNIufIsA7RdpVgacC2cSpw==",[m
[31m-      "dev": true,[m
[31m-      "license": "MIT"[m
[31m-    },[m
     "node_modules/tmpl": {[m
       "version": "1.0.5",[m
       "resolved": "https://registry.npmmirror.com/tmpl/-/tmpl-1.0.5.tgz",[m
[36m@@ -7453,19 +7474,6 @@[m
         "node": ">=4"[m
       }[m
     },[m
[31m-    "node_modules/type-fest": {[m
[31m-      "version": "0.20.2",[m
[31m-      "resolved": "https://registry.npmmirror.com/type-fest/-/type-fest-0.20.2.tgz",[m
[31m-      "integrity": "sha512-Ne+eE4r0/iWnpAxD852z3A+N0Bt5RN//NjJwRd2VFHEmrywxf5vsZlh4R6lixl6B+wz/8d+maTSAkN1FIkI3LQ==",[m
[31m-      "dev": true,[m
[31m-      "license": "(MIT OR CC0-1.0)",[m
[31m-      "engines": {[m
[31m-        "node": ">=10"[m
[31m-      },[m
[31m-      "funding": {[m
[31m-        "url": "https://github.com/sponsors/sindresorhus"[m
[31m-      }[m
[31m-    },[m
     "node_modules/type-is": {[m
       "version": "1.6.18",[m
       "resolved": "https://registry.npmmirror.com/type-is/-/type-is-1.6.18.tgz",[m
[1mdiff --git a/functions/package.json b/functions/package.json[m
[1mindex e096a3c..a9824ff 100644[m
[1m--- a/functions/package.json[m
[1m+++ b/functions/package.json[m
[36m@@ -15,14 +15,15 @@[m
     "deploy": "firebase deploy --only functions"[m
   },[m
   "dependencies": {[m
[32m+[m[32m    "boots-pos-gemini": "file:..",[m
[32m+[m[32m    "cors": "^2.8.5",[m
     "firebase-admin": "^12.7.0",[m
[31m-    "firebase-functions": "^6.4.0",[m
[31m-    "cors": "^2.8.5"[m
[32m+[m[32m    "firebase-functions": "^7.0.5"[m
   },[m
   "devDependencies": {[m
[31m-    "eslint": "^9.39.2",[m
     "@eslint/js": "^9.39.2",[m
[31m-    "globals": "^17.2.0",[m
[31m-    "firebase-functions-test": "^3.1.0"[m
[32m+[m[32m    "eslint": "^9.39.2",[m
[32m+[m[32m    "firebase-functions-test": "^3.1.0",[m
[32m+[m[32m    "globals": "^17.2.0"[m
   }[m
 }[m
