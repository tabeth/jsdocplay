// the semi-colon before function invocation is a safety net against concatenated
// scripts and/or other plugins which may not be closed properly.
;(function ( $, window, document) {
    // null is used here as the null global variable in ECMAScript 3 is
    // mutable (ie. it can be changed by someone else). null isn't really being
    // passed in so we can ensure the value of it is truly null. In ES5, null
    // can no longer be modified.

    // window and document are passed through as local variable rather than global
    // as this (slightly) quickens the resolution process and can be more efficiently
    // minified (especially when both are regularly referenced in your plugin).

    // Create the defaults once
    var pluginName = "jsblock",
        defaults = {
          editable: true,
          consoleText: "Output from the example appears here",
		  consoleClass: "jsblock-console-text",
          runButtonText: "run",
          runButtonClass: "jsblock-console-run",
          console: true,
          resetable: true,
          runnable: true,
          editorTheme: "ace/theme/dawn",
          lineNumbers: true
        };

    // The actual plugin constructor
    function JsBlock( element, options ) {
        this.element = element;
        this.original = $(this.element);
		this.enabled = true;

        // jQuery has an extend method which merges the contents of two or
        // more objects, storing the result in the first object. The first object
        // is generally empty as we don't want to alter the default options for
        // future instances of the plugin
        this.options = $.extend( {}, defaults, options );

        this._defaults = defaults;
        this._name = pluginName;
        this._exports = {
            "run": this.run,
            "reset": this.reset,
            "destroy": this.destroy,
            "editor": this.getEditor,
            "text": this.getSetText,
            "runnable": this.getSetRunnable,
            "editable": this.getSetEditable
        };

        this.init();
    }

    JsBlock.prototype = {
        init: function() {
          this.setUpDom();
          this.setUpEditor();
          if (this.options.console) {
            this.createConsole();
          }
          if (this.options.resetable) {
            this.createResetButton();
          }
		  this.base.data("plugin_" + pluginName, this);
        },

        setUpDom: function() {
            //the ACE editor directly manipulates the classes, etc. of the
            //element it latches on to, so we set up an encapsulating DOM structure
            this.el = $('<div></div>').addClass("jsblock-container");
            var inner = $('<div></div>').addClass("jsblock-editor-wrapper");

			this.base = this.original.clone();

            //A set width & height keeps the editor the right size.
            //TODO: make this configurable
            var width = this.original.width();
            this.el.width(width);
            inner.height(this.original.height()*1.1);

            //Strip whitespace to make writing html easier
            this.base.html($.trim(this.base.html()));
            this.base.addClass("jsblock-editor");

			this.originalText = this.base.text();

            this.el.insertBefore(this.original);
            this.el.append(inner);
            inner.append(this.base);
			this.original.remove();
        },

        setUpEditor: function() {
            //Set up ace editor - requires an ID to latch on to
            if (!this.base.attr("id")) {
                this.base.attr("id", "jsblock-editor-"+(+new Date));
            }

            this.editor = ace.edit(this.base.attr("id"));
            this.editor.setTheme(this.options.editorTheme);
            this.editor.getSession().setUseWorker(false);
            this.editor.getSession().setMode("ace/mode/javascript");
            this.editor.setShowFoldWidgets(false);
            //override their fancy ctrl-f, ctrl-r: http://stackoverflow.com/questions/13677898/how-to-disable-ace-editors-find-dialog
            this.editor.commands.addCommands([{
                    name: "unfind",
                    bindKey: { win: "Ctrl-F", mac: "Command-F" },
                    exec: function(editor, line) { return false; },
                    readOnly: true
            }, {
                    name: "unreplace",
                    bindKey: { win: "Ctrl-R", mac: "Command-R" },
                    exec: function(editor, line) { return false; },
                    readOnly: true
            }]);

            this.editor.setReadOnly(!this.options.editable);
			this.editor.renderer.setShowGutter(this.options.lineNumbers);
        },

        createConsole: function() {
            var console_wrapper = $('<div></div>').addClass("jsblock-console");
            this.console  = $("<span></span>").addClass("jsblock-console-text");
            console_wrapper.append(this.console);
            this.console.text(this.options.consoleText);
            this.console.addClass("placeholder");
            this.console.width(this.el.width() - 70);

			if (this.options.runnable) {
				this.runButton = $("<span></span>").addClass("jsblock-console-run");
				this.runButton.text(this.options.runButtonText);

				var cur = this;
				this.runButton.click(function() {
				  if (cur.enabled) {
					  cur.run();
				  }
				});
				console_wrapper.append(this.runButton);
			}

            this.el.append(console_wrapper);
        },

        createResetButton: function() {
            var reset_button = $("<i></i>").addClass("jsblock-reset").attr("title", "Reset");

            var cur = this;
            reset_button.click(function() {
              cur.reset();
              return false;
            });
            this.base.after(reset_button);
        },

		destroy: function() {
			this.editor.destroy();
			this.editor = null;
			this.options = null;
			this.originalText = null;
			this.console = null;
			this.runButton = null;

			this.original.insertBefore(this.el);
			$.removeData(this.element, "plugin_" + pluginName);
			this.base.removeData("plugin_" + pluginName);

			this.base.remove();
			this.base = null;
			this.el.remove();
			this.el = null;
		},

        run: function() {
		    this.base.add(this.original).trigger("jsblock.run");

            var val = this.editor.getValue();
            //clear text
            this.console.text('');
            this.console.removeClass("placeholder");
            var cur = this;
            //closure to overload console
            (function(){
                var c = {};
                c.log = function() {
                    var text = $.makeArray(arguments).join(" ");
                    var currText = cur.console.html();
                    currText += text + "<br/>";
                    cur.console.html(currText);
					cur.base.add(cur.original).trigger("jsblock.console", [text]);
                };
                try {
                    //To catch returns & exceptions
                    //NOTE - this must be minified "by hand" to make sure that
                    //the variable named "console" is preserved
                    //Depending on your minifier, you may be able to set javascript
                    //comment flags to tell the minifier not to compile this
                    (function(console){eval(val);})(c);
                } catch (err) {
                    c.log("Error:", err);
                }
            })();

		    return this;
        },

        reset: function() {
          this.base.add(this.original).trigger("jsblock.reset");

          this.editor.setValue(this.originalText);
          this.editor.clearSelection();
          this.editor.navigateFileStart();
          this.console.text(this.options.consoleText);
          this.console.addClass('placeholder');

		  return this;
        },

		getSetText: function(newText) {
		  if (newText !== null) {
			  this.editor.setValue(newText);
			  return this;
		  } else {
			  return this.editor.getValue();
		  }
		},

		getEditor: function(){
		  return this.editor;
		},

		getSetEditable: function(param){
		  if (param !== null) {
			  this.editor.setReadOnly(!param);
			  return this;
		  } else {
			  return !this.editor.getReadOnly();
		  }
		},

		getSetRunnable: function(param){
		  if (param !== null) {
			  this.enabled = param;
			  this.runButton.toggleClass("disabled", !param);
			  return this;
		  } else {
		  	  return this.options.runnable && this.enabled;
		  }
		}
    };

    // A really lightweight plugin wrapper around the constructor,
    // preventing against multiple instantiations and allowing for
    // jquery-ui like method calls
    $.fn[pluginName] = function () {
		if (arguments.length === 0 || (arguments.length == 1 && typeof arguments[0] === "object")) {
			//constructor
			var options = arguments[0];
            return this.each(function(){
                var jsblock = $.data(this, "plugin_" + pluginName);
				if (!jsblock) {
                    jsblock = new JsBlock( this, options );
					$.data(this, "plugin_" + pluginName, jsblock);
				}
			});
		} else {
			//action (i.e. $(".blah").jsblock('run');
			var action = arguments[0];
			var params = Array.prototype.slice.call(arguments, 1);
            var ret = this.map(function(){
				var jsblock = $.data(this, "plugin_" + pluginName);
				if (jsblock) {
					var method = jsblock._exports[action];
					if (!method) { throw "Codeblock has no method "+action;}
					return method.apply(jsblock, params);
				}
			}).get();

            //return "this" for everything but the getters
            if (action === "editor" || (params.length ===0 && (action == "runnable" || action == "editable"))) {
                return ret.length >= 1 ? ret[0] : null;
            } else if (params.length === 0 && action == "text") {
                return ret.join();
            } else {
                return this;
            }
		}
    };
})( jQuery, window, document );
