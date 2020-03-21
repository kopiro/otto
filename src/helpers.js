const uuidMod = require("uuid");
const _ = require("underscore");
const diacriticsRemove = require("diacritics").remove;
const request = require("request");
const fs = require("fs");
const md5 = require("md5");
const path = require("path");
const config = require("./config");
const Translator = require("./lib/translator");
const { cacheDir } = require("./paths");

/**
 * Pick a random element in an array
 * @param {Array} e
 */
function rand(e) {
  return _.isArray(e) ? e[_.random(0, e.length - 1)] : e;
}

/**
 * Timeout using promises
 * @param {Number} ms
 */
function timeout(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a UUID v4
 */
function uuid() {
  return uuidMod.v4();
}

/**
 * Clean text by removing diacritics and lowering its case
 * @param {String} t
 */
function cleanText(t) {
  return diacriticsRemove(t).toLowerCase();
}

/**
 * Split a text using a pattern to mimic a message sent by a human
 * @param {String} text
 */
function mimicHumanMessage(text) {
  const splitted = text.split(/\\n|\n|\.(?=\s+|[A-Z])/);
  return _.compact(splitted);
}

/**
 * Get the locale string from a language
 * @param {String} language
 * @returns {String}
 */
function getLocaleFromLanguageCode(language = null) {
  switch (language) {
    case "de":
      return "de-DE";
    case "da":
      return "da-DK";
    case "it":
      return "it-IT";
    case "is":
      return "is-IS";
    case "fr":
      return "fr-FR";
    case "es":
      return "es-ES";
    case "tr":
      return "tr-TR";
    case "ru":
      return "ru-RU";
    case "ro":
      return "ro-RO";
    case "en":
      return "en-GB";
    case "ja":
      return "ja-JP";
    case "cy":
      return "cy-GB";
    case "pt":
      return "pt-PT";
    case "nl":
      return "nl-NL";
    case "nb":
      return "nb-NO";
    case "sv":
      return "sv-SE";
    default:
      return getLocaleFromLanguageCode(config.language);
  }
}

/**
 * Get the local URI of a remote object by downloading it
 * @param {String} uri
 */
function getLocalObjectFromURI(uri) {
  const TAG = "getLocalObjectFromURI";

  return new Promise((resolve, reject) => {
    if (Buffer.isBuffer(uri)) {
      const localFile = path.join(cacheDir, `${uuid()}.unknown`);
      console.debug(TAG, `writing buffer to local file <${localFile}>`);
      fs.writeFileSync(localFile, uri);
      return resolve(localFile);
    }

    if (uri.buffer) {
      const localFile = path.join(
        cacheDir,
        `${uuid()}.${uri.extension || "unknown"}`
      );
      console.debug(TAG, `writing buffer to local file <${localFile}>`);
      fs.writeFileSync(
        localFile,
        Buffer.from(uri.buffer.toString("hex"), "hex")
      );
      return resolve(localFile);
    }

    if (/^https?:\/\//.test(uri)) {
      const extension = uri.split(".").pop() || "unknown";
      const localFile = path.join(cacheDir, `${md5(uri)}.${extension}`);
      if (fs.existsSync(localFile)) {
        return resolve(localFile);
      }

      return request(uri)
        .pipe(fs.createWriteStream(localFile))
        .on("close", () => {
          if (!fs.existsSync(localFile)) return reject();
          return resolve(localFile);
        });
    }

    return resolve(uri);
  });
}

function extractWithPattern(input, pattern) {
  if (input == null) return null;
  if (pattern === "") return input;

  const p = pattern.split(".");
  let _p = p.shift();

  // Array search
  if (_p === "[]") {
    _p = p.shift();
    for (const _input of input) {
      if (_input[_p] != null) {
        const found = extractWithPattern(_input[_p], p.join("."));
        if (found) return found;
      }
    }
    return null;
  }

  if (p.length === 0) {
    return input[_p];
  }

  return extractWithPattern(input[_p], p.join("."));
}

const JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP = {
  [typeof 0]: "numberValue",
  [typeof ""]: "stringValue",
  [typeof false]: "boolValue"
};

const JSON_SIMPLE_VALUE_KINDS = new Set([
  "numberValue",
  "stringValue",
  "boolValue"
]);

function jsonValueToProto(value) {
  const valueProto = {};

  if (value === null) {
    valueProto.kind = "nullValue";
    valueProto.nullValue = "NULL_VALUE";
  } else if (value instanceof Array) {
    valueProto.kind = "listValue";
    valueProto.listValue = { values: value.map(jsonValueToProto) };
  } else if (typeof value === "object") {
    valueProto.kind = "structValue";
    // eslint-disable-next-line no-use-before-define
    valueProto.structValue = jsonToStructProto(value);
  } else if (typeof value in JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP) {
    const kind = JSON_SIMPLE_TYPE_TO_PROTO_KIND_MAP[typeof value];
    valueProto.kind = kind;
    valueProto[kind] = value;
  } else {
    console.warn("Unsupported value type ", typeof value);
  }
  return valueProto;
}

function jsonToStructProto(json) {
  const fields = {};
  for (const k of Object.keys(json)) {
    fields[k] = jsonValueToProto(json[k]);
  }
  return { fields };
}

function structProtoToJson(proto) {
  if (!proto || !proto.fields) {
    return {};
  }
  const json = {};
  for (const k of Object.keys(proto.fields)) {
    // eslint-disable-next-line no-use-before-define
    json[k] = valueProtoToJson(proto.fields[k]);
  }
  return json;
}

function valueProtoToJson(proto) {
  if (!proto || !proto.kind) {
    return null;
  }

  if (JSON_SIMPLE_VALUE_KINDS.has(proto.kind)) {
    return proto[proto.kind];
  }
  if (proto.kind === "nullValue") {
    return null;
  }
  if (proto.kind === "listValue") {
    if (!proto.listValue || !proto.listValue.values) {
      console.warn("Invalid JSON list value proto: ", JSON.stringify(proto));
    }
    return proto.listValue.values.map(valueProtoToJson);
  }
  if (proto.kind === "structValue") {
    return structProtoToJson(proto.structValue);
  }
  console.warn("Unsupported JSON value proto kind: ", proto.kind);
  return null;
}

function getAiNameRegex() {
  return new RegExp(config.aiNameRegex, "gi");
}

function replaceVariablesInStrings(text, data) {
  let reLoop = null;
  let textCopy = text;
  const re = /\$_(\w+)/g;
  // eslint-disable-next-line no-cond-assign
  while ((reLoop = re.exec(text))) {
    const inVar = reLoop[1];
    if (data[inVar]) {
      textCopy = textCopy.replace(`$_${inVar}`, data[inVar] || "");
    }
  }
  return textCopy;
}

async function getLanguageCodeFromLanguageLongString(languageLongString) {
  const languages = await Translator.getLanguages(config.language);
  const langObject = _.findWhere(languages, { name: languageLongString });
  return langObject && langObject.code;
}

module.exports = {
  getAiNameRegex,
  valueProtoToJson,
  structProtoToJson,
  jsonToStructProto,
  jsonValueToProto,
  extractWithPattern,
  getLocalObjectFromURI,
  getLocaleFromLanguageCode,
  mimicHumanMessage,
  cleanText,
  uuid,
  timeout,
  rand,
  replaceVariablesInStrings,
  getLanguageCodeFromLanguageLongString
};
