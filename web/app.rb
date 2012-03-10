require 'rubygems'
require 'bundler/setup'
require 'sinatra'

#Just redirect to the simplte test page.
get '/' do
	redirect to('/simple-test.html')
end