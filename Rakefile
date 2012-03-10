#!/usr/bin/ruby
#coding: utf-8

##########
# CONFIG #
##########

ENCODING = Encoding::UTF_8

SRC_DIR = 'src'
MIN_DIR = 'min'
WEB_SCRIPTS_DIR = File.join('web', 'public', 'scripts')

SRC_GLOB = File.join(SRC_DIR, '**', '*.js')
MIN_GLOB = File.join(MIN_DIR, '**', '*.js')

RHINOJAR = File.join('vendor', 'rhino.jar')
JSLINT_PATH = File.join('vendor', 'jslint.js')

# Define our minify method. Change this if you want to minify using something of your choice.
def minify (*input, output)
	Kernel.system("vendor/ajaxmin.exe -js -global:define,window -clobber:true #{input.join(' ')} -out #{output}")
end

desc "Minifies all AMD modules in '#{SRC_DIR}' and copies the minified versions of each module to 'web/public/scripts'. A copy of '#{SRC_DIR}/define.js' is also copied to 'web/public/amdjs-tests/impl/definejs'."
task :default

# Make sure we have a min directory.
directory MIN_DIR


##############
# SYNTHESIZE #
##############

=begin
	Here we synthesize a file task for each source JavaScript file. This file task
	will minify the source file and save the minified version to JS_OUT_DIR.

	Finally this block adds each newly created file task as a dependency to the 'default' task.
=end
FileList[SRC_GLOB].each do |src|
	path = File.dirname(src)
	extname = File.extname(src)
	filename = File.basename(src, extname)
	js_minified_file = File.join(MIN_DIR, "#{filename}#{extname}")

	file js_minified_file => src do |t|
		minify(src, t.name)
	end
end

=begin
	Creates a task that copies all files from the srcGlob to a destination.

	Usage:
		create_copy_task 'articles/*.gif', 'articles', :articles

	Reference:
		http://martinfowler.com/articles/rake.html
=end
def create_copy_task srcGlob, targetDir, taskSymbol
  mkdir_p(targetDir, :verbose => false)
  FileList[srcGlob].each do |f|
    target = File.join(targetDir, File.basename(f))
    file target => [f] do |t|
      cp f, target
    end
    task taskSymbol => target
  end
end


#########
# TASKS #
#########

# Create the task to copy all our unminified source files.
create_copy_task(MIN_GLOB, 'web/public/scripts', :scripts)
# Copy the source define.js to the appropriate directory in amdjs-tests.
create_copy_task(File.join(MIN_DIR, 'define.js'), 'web/public/amdjs-tests/impl/definejs', :scripts)

# Add all file tasks to the default task.
Rake.application.tasks.each do |t|
	if t.kind_of? Rake::FileTask
		task :default => [t.name]
	end
end

desc "Check JavaScript source in the '#{SRC_DIR}' with JSLint - exit with status 1 if a file fails."
task :jslint do |t, args|
	FileList["#{SRC_DIR}/**/*.js"].exclude("**/_*.js").each do |fname|
		cmd = "java -cp #{RHINOJAR} org.mozilla.javascript.tools.shell.Main #{JSLINT_PATH} #{fname}"
		results = %x{#{cmd}}

		unless results.length == 0
			puts "#{fname}:"
			puts results
			exit 1
		end
	end
end