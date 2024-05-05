const jsdom = require("jsdom");
const {JSDOM} = jsdom;
const dom = new JSDOM(`<!DOCTYPE html><p>Hello world</p>`);
window = dom.window;
document = window.document;
XMLHttpRequest = window.XMLHttpRequest;

const http = require('http') // 引入http模块
const express = require('express')
const path = require('path')
const app = express()

const hostname = '127.0.0.1'
const port = 3001
app.use(express.static(__dirname+'/..'))

app.listen(port ,() => {
    console.log('Server running at http://'+hostname+':'+port.toString()+'/')
})
