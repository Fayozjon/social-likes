/**
 * Social Likes
 * http://sapegin.github.com/social-likes
 *
 * Sharing buttons for Russian and worldwide social networks.
 *
 * @requires jQuery
 * @author Artem Sapegin
 * @copyright 2014 Artem Sapegin (sapegin.me)
 * @license MIT
 */

/*global define:false, socialLikesButtons:false */

(function(factory) {  // Try to register as an anonymous AMD module
	if (typeof define === 'function' && define.amd) {
		define(['jquery'], factory);
	}
	else {
		factory(jQuery);
	}
}(function($, undefined) {
'use strict';

var prefix = 'social-likes';
var classPrefix = prefix + '__';
var visibleClass = prefix + '_visible';


/**
 * Buttons
 */
var services = {
	facebook: {
		counterUrl: 'http://graph.facebook.com/fql?q=SELECT+total_count+FROM+link_stat+WHERE+url%3D%22{url}%22&callback=?',
		convertNumber: function(data) {
			return data.data[0].total_count;
		},
		popupUrl: 'http://www.facebook.com/sharer/sharer.php?u={url}',
		popupWidth: 600,
		popupHeight: 500
	},
	twitter: {
		counterUrl: 'http://urls.api.twitter.com/1/urls/count.json?url={url}&callback=?',
		convertNumber: function(data) {
			return data.count;
		},
		popupUrl: 'http://twitter.com/intent/tweet?url={url}&text={title}',
		popupWidth: 600,
		popupHeight: 450,
		click: function() {
			// Add colon to improve readability
			if (!/[\.:\-–—]\s*$/.test(this.options.pageTitle)) this.options.pageTitle += ':';
			return true;
		}
	},
	mailru: {
		counterUrl: 'http://connect.mail.ru/share_count?url_list={url}&callback=1&func=?',
		convertNumber: function(data) {
			for (var url in data) {
				if (data.hasOwnProperty(url)) {
					return data[url].shares;
				}
			}
		},
		popupUrl: 'http://connect.mail.ru/share?share_url={url}&title={title}',
		popupWidth: 550,
		popupHeight: 360
	},
	vkontakte: {
		counterUrl: 'http://vkontakte.ru/share.php?act=count&url={url}&index={index}',
		counter: function(jsonUrl, deferred) {
			var options = services.vkontakte;
			if (!options._) {
				options._ = [];
				if (!window.VK) window.VK = {};
				window.VK.Share = {
					count: function(idx, number) {
						options._[idx].resolve(number);
					}
				};
			}

			var index = options._.length;
			options._.push(deferred);
			$.ajax({
				url: makeUrl(jsonUrl, {index: index}),
				dataType: 'jsonp'
			});
		},
		popupUrl: 'http://vk.com/share.php?url={url}&title={title}',
		popupWidth: 550,
		popupHeight: 330
	},
	odnoklassniki: {
		counterUrl: 'http://www.odnoklassniki.ru/dk?st.cmd=shareData&ref={url}&cb=?',
		convertNumber: function(data) {
			return data.count;
		},
		popupUrl: 'http://www.odnoklassniki.ru/dk?st.cmd=addShare&st._surl={url}',
		popupWidth: 550,
		popupHeight: 360
	},
	plusone: {
		counterUrl: 'http://share.yandex.ru/gpp.xml?url={url}',
		counter: function(jsonUrl, deferred) {
			var options = services.plusone;
			if (options._) return;

			if (!window.services) window.services = {};
			window.services.gplus = {
				cb: function(number) {
					options._.resolve(number);
				}
			};

			options._ = deferred;
			$.ajax({
				url: makeUrl(jsonUrl),
				dataType: 'jsonp'
			});
		},
		popupUrl: 'https://plus.google.com/share?url={url}',
		popupWidth: 700,
		popupHeight: 500
	},
	pinterest: {
		counterUrl: 'http://api.pinterest.com/v1/urls/count.json?url={url}&callback=?',
		convertNumber: function(data) {
			return data.count;
		},
		popupUrl: 'http://pinterest.com/pin/create/button/?url={url}&description={title}',
		popupWidth: 630,
		popupHeight: 270
	}
};


/**
 * Counters manager
 */
var counters = {
	promises: {},
	fetch: function(service, url, extraOptions) {
		if (!counters.promises[service]) counters.promises[service] = {};
		var servicePromises = counters.promises[service];

		if (servicePromises[url]) {
			return servicePromises[url];
		}
		else {
			var options = $.extend({}, services[service], extraOptions);
			var deferred = $.Deferred();
			var jsonUrl = options.counterUrl && makeUrl(options.counterUrl, {url: url});

			if ($.isFunction(options.counter)) {
				options.counter(jsonUrl, deferred);
			}
			else if (options.counterUrl) {
				$.getJSON(jsonUrl)
					.done(function(data) {
						try {
							var number = data;
							if ($.isFunction(options.convertNumber)) {
								number = options.convertNumber(data);
							}
							deferred.resolve(number);
						}
						catch (e) {
							deferred.reject(e);
						}
					});
			}

			servicePromises[url] = deferred.promise();
			return servicePromises[url];
		}
	}
};


/**
 * jQuery plugin
 */
$.fn.socialLikes = function(opts) {
	return this.each(function() {
		new SocialLikes($(this), opts);
	});
};


function SocialLikes(container, opts) {
	this.container = container;
	this.init(opts);
}

SocialLikes.prototype = {
	optionsMap: {
		pageUrl: {
			attr: 'url',
			defaultValue: function() { return window.location.href.replace(window.location.hash, ''); }
		},
		pageTitle: {
			attr: 'title',
			defaultValue: function() { return document.title; }
		},
		pageHtml: {
			attr: 'html',
			defaultValue: function() { return '<a href="' + this.options.pageUrl + '">' + this.options.pageTitle + '</a>'; }
		},
		showCounters: {
			attr: 'counters',
			defaultValue: 'yes',
			convert: function(value) { return value === true || value === 'yes'; }
		},
		showZeroes: {
			attr: 'zeroes',
			defaultValue: 'no',
			convert: function(value) { return value === true || value === 'yes'; }
		},
		singleTitle: {
			attr: 'single-title',
			defaultValue: 'Share'
		}
	},
	init: function(opts) {
		// Add class in case of manual initialization
		this.container.addClass(prefix);

		this.readOptions(opts);
		this.single = this.container.hasClass(prefix + '_single');

		this.initUserButtons();
		this.makeSingleButton();

		var options = this.options;
		this.container.children().each(function() {
			new Button($(this), options);
		});
	},
	readOptions: function(opts) {
		opts = opts || {};
		this.options = {};

		for (var key in this.optionsMap) {
			var option = this.optionsMap[key];
			var value = opts[option.attr] !== undefined ? opts[option.attr] : this.container.data(option.attr);

			if (value === undefined) {
				if ($.isFunction(option.defaultValue)) {
					value = $.proxy(option.defaultValue, this)();
				}
				else {
					value = option.defaultValue;
				}
			}
			if ($.isFunction(option.convert)) {
				value = option.convert(value);
			}
			this.options[key] = value;
		}
	},
	initUserButtons: function() {
		if (!this.userButtonInited && window.socialLikesButtons) {
			$.extend(true, services, socialLikesButtons);
		}
		this.userButtonInited = true;
	},
	makeSingleButton: function() {
		if (!this.single) return;

		var container = this.container;
		container.addClass(prefix + '_vertical');
		container.wrap($('<div>', {'class': prefix + '_single-w'}));
		var wrapper = container.parent();

		var defaultLeft = parseInt(container.css('left'), 10);
		var defaultTop = parseInt(container.css('top'), 10);

		// Widget
		var widget = $('<div>', {
			'class': getElementClassNames('widget', 'single')
		});
		var button = $(template(
			'<div class="{buttonCls}">' +
				'<span class="{iconCls}"></span>' +
				this.options.singleTitle +
			'</div>',
			{
				buttonCls: getElementClassNames('button', 'single'),
				iconCls: getElementClassNames('icon', 'single')
			}
		));
		widget.append(button);
		wrapper.append(widget);

		button.click(function() {
			container.css({ left: defaultLeft,  top: defaultTop });
			showInViewport(container, 20);
			closeOnClick(container);
			return false;
		});

		// Close button
		var close = $('<div>', {
			'class': classPrefix + 'close',
			'html': '&times;'
		});
		container.append(close);

		close.click(function() {
			container.removeClass(visibleClass);
		});

		this.number = 0;

		this.widget = widget;

		this.container.on('counter.' + prefix, $.proxy(this.updateCounter, this));
	},
	updateCounter: function(e, service, number) {
		if (!number) return;

		this.number += number;
		this.getCounterElem().text(this.number);
	},
	getCounterElem: function() {
		var counterElem = this.widget.find('.' + classPrefix + 'counter_single');
		if (!counterElem.length) {
			counterElem = $('<span>', {
				'class': getElementClassNames('counter', 'single')
			});
			this.widget.append(counterElem);
		}
		return counterElem;
	}
};


function Button(widget, options) {
	this.widget = widget;
	this.options = $.extend({}, options);
	this.detectService();
	if (this.service) {
		this.init();
	}
}

Button.prototype = {
	init: function() {
		this.detectParams();
		this.initHtml();

		if (this.options.showCounters) {
			if (this.options.counterNumber) {
				this.updateCounter(this.options.counterNumber);
			}
			else {
				var extraOptions = this.options.counterUrl ? { counterUrl: this.options.counterUrl } : {};
				counters.fetch(this.service, this.options.pageUrl, extraOptions)
					.done($.proxy(this.updateCounter, this));
			}
		}
	},

	detectService: function() {
		var classes = this.widget[0].classList || this.widget[0].className.split(' ');
		for (var classIdx = 0; classIdx < classes.length; classIdx++) {
			var cls = classes[classIdx];
			if (services[cls]) {
				this.service = cls;
				$.extend(this.options, services[cls]);
				return;
			}
		}
	},

	detectParams: function() {
		// Custom page counter URL or number
		var counter = this.widget.data('counter');
		if (counter) {
			var number = parseInt(counter, 10);
			if (isNaN(number))
				this.options.counterUrl = counter;
			else
				this.options.counterNumber = number;
		}
		
		var customTitle = this.widget.data('title');
		if (customTitle)
			this.options.pageTitle = customTitle;

		var customUrl = this.widget.data('url');
		if (customUrl)
			this.options.pageUrl = customUrl;
	},

	initHtml: function() {
		var options = this.options;
		var widget = this.widget;
		var isLink = !!options.clickUrl;

		widget.removeClass(this.service);
		widget.addClass(this.getElementClassNames('widget'));

		// Old initialization HTML
		var a = widget.find('a');
		if (a.length) {
			this.cloneDataAttrs(a, widget);
		}

		// Button
		var button = $(isLink ? '<a>' : '<span>', {
			'class': this.getElementClassNames('button'),
			'text': widget.text()
		});
		if (isLink) {
			var url = makeUrl(options.clickUrl, {
				url: options.pageUrl,
				title: options.pageTitle
			});
			button.attr('href', url);
		}
		else {
			button.click($.proxy(this.click, this));
		}

		// Icon
		button.prepend($('<span>', {'class': this.getElementClassNames('icon')}));

		widget.empty().append(button);
		this.button = button;
	},

	cloneDataAttrs: function(source, destination) {
		var data = source.data();
		for (var key in data) {
			if (data.hasOwnProperty(key)) {
				destination.data(key, data[key]);
			}
		}
	},

	getElementClassNames: function(elem) {
		return getElementClassNames(elem, this.service);
	},

	updateCounter: function(number) {
		number = parseInt(number, 10);
		if (!number && !this.options.showZeroes) return;

		var counterElem = $('<span>', {
			'class': this.getElementClassNames('counter'),
			'text': number,
		});
		this.widget.append(counterElem);

		this.widget.trigger('counter.' + prefix, [this.service, number]);
	},

	click: function(e) {
		var options = this.options;
		var process = true;
		if ($.isFunction(options.click)) {
			process = options.click.call(this, e);
		}
		if (process) {
			var url = makeUrl(options.popupUrl, {
				url: options.pageUrl,
				title: options.pageTitle
			});
			url = this.addAdditionalParamsToUrl(url);
			this.openPopup(url, {
				width: options.popupWidth,
				height: options.popupHeight
			});
		}
		return false;
	},

	addAdditionalParamsToUrl: function(url) {
		var params = $.param(this.widget.data());
		if (!params) return url;
		var glue = url.indexOf('?') === -1 ? '?' : '&';
		return url + glue + params;
	},

	openPopup: function(url, params) {
		var left = Math.round(screen.width/2 - params.width/2);
		var top = 0;
		if (screen.height > params.height) {
			top = Math.round(screen.height/3 - params.height/2);
		}

		var win = window.open(url, 'sl_' + this.service, 'left=' + left + ',top=' + top + ',' +
			'width=' + params.width + ',height=' + params.height + ',personalbar=0,toolbar=0,scrollbars=1,resizable=1');
		if (win) {
			win.focus();
		}
		else {
			location.href = url;
		}
	}
};


/**
 * Helpers
 */

function makeUrl(url, context) {
	return template(url, context, encodeURIComponent);
}

function template(tmpl, context, filter) {
	return tmpl.replace(/\{([^\}]+)\}/g, function(m, key) {
		// If key don't exists in the context we should keep template tag as is
		return key in context ? (filter ? filter(context[key]) : context[key]) : m;
	});
}

function getElementClassNames(elem, mod) {
	var cls = classPrefix + elem;
	return cls + ' ' + cls + '_' + mod;
}

function closeOnClick(elem) {
	function handler(e) {
		if ((e.type === 'keydown' && e.which !== 27) || $(e.target).closest(elem).length) return;
		elem.removeClass(visibleClass);
		doc.off(events, handler);
	}
	var doc = $(document);
	var events = 'click touchstart keydown';
	doc.on(events, handler);
}

function showInViewport(elem, offset) {
	if (document.documentElement.getBoundingClientRect) {
		var left = parseInt(elem.css('left'), 10);
		var top = parseInt(elem.css('top'), 10);

		var rect = elem[0].getBoundingClientRect();
		if (rect.left < offset)
			elem.css('left', offset - rect.left + left);
		else if (rect.right > window.innerWidth - offset)
			elem.css('left', window.innerWidth - rect.right - offset + left);

		if (rect.top < offset)
			elem.css('top', offset - rect.top + top);
		else if (rect.bottom > window.innerHeight - offset)
			elem.css('top', window.innerHeight - rect.bottom - offset + top);
	}
	elem.addClass(visibleClass);
}


/**
 * Auto initialization
 */
$(function() {
	$('.' + prefix).socialLikes();
});

}));
