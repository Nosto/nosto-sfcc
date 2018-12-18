/**
* Helper script for Nosto
**/
var Site = require('dw/system/Site').getCurrent();
var ProductMgr = require('dw/catalog/ProductMgr');
var CatalogMgr = require('dw/catalog/CatalogMgr');
var Template = require('dw/util/Template');
var HashMap = require('dw/util/HashMap');
var PromotionMgr = require('dw/campaign/PromotionMgr');
var BasketMgr = require('dw/order/BasketMgr');

var nostoHelper = {
	getEnableNostoTagging : function () {
		return Site.getCustomPreferenceValue("nostoEnableTagging");
	},
	getNostoScriptURL : function () {
		return Site.getCustomPreferenceValue("nostoScriptURL");
	},
	getNostoProductAttributeConfiguration : function () {
		return Site.getCustomPreferenceValue("nostoProductConfig");
	},
	getNostoScriptURLByLocale : function () {
		let scriptURLs = JSON.parse(this.getNostoScriptURL()),
			locale = request.getLocale();
		return scriptURLs[locale] ? scriptURLs[locale] : scriptURLs['default'];
	},
	checkIfNostoBrand : function (category) {
		if (category.custom.nostoBrand && category.custom.nostoBrand == true){
			return true;
		}
		return false;
	},
	getProductAttributes : function (product) {
		let i = 0,
			masterProduct,
			productType,
			productObject = new HashMap(),
			skus = [];
		if (product.bundle){
			masterProduct = product;
			productType = product.bundledProducts;
		}else if (product.master){
			masterProduct = product;
			productType = product.variants;
		}else if (product.productSet){
			masterProduct = product;
			productType = product.productSetProducts;
		}else if (product.optionProduct){
			masterProduct = product;
		}else if (!product.variant){
			masterProduct = product;
		}else{
			masterProduct = product.getMasterProduct();
			productType = masterProduct.variants;
		}
		productObject.put('name', masterProduct.getName());
		productObject.put('url', dw.web.URLUtils.https('Product-Show','pid', masterProduct.ID).toString());
		productObject.put('images', this.getImageUrls(masterProduct));
		productObject.put('prices', this.getPrices(masterProduct));
		productObject.put('availability', this.getProductAvailability(masterProduct));
		productObject.put('categories', this.getCategoryAssignments(masterProduct));
		productObject.put('primaryCategory', this.populateCategoryTags(masterProduct.primaryCategory).category);
		if (product.productSet){
			for each(var productSetMaster in productType){
				for each(var variant in productSetMaster.variants){
					skus.push(this.populateVariantAttributes(variant));
				}
			}
		}else if (!masterProduct.optionProduct){
			for each(var variant in productType) {
				skus.push(this.populateVariantAttributes(variant));
			}
		}
		productObject.put('skus', skus);
		productObject.put('currencyCode', Site.defaultCurrency);
		productObject.put('preferenceFields', this.populateProductAttributesFromPreference(masterProduct));
		return productObject;
	},
	populateProductAttributesFromPreference : function (product) {
		let productAttr = JSON.parse(this.getNostoProductAttributeConfiguration()),
			preferenceFields = [],
			customFields = [],
			attributeObject = new HashMap()
			hasProdId = false;
		for (var key in productAttr) {
			let preferenceField = {},
				arr = productAttr[key].split('.'),
				productIterator = ( (arr.length > 1) ? product: product[productAttr[key]] ) || 'null',
				i = 0;
			if (product.variant && arr[0] != 'custom'){
				continue;
			}
			if (productIterator == 'null'){
				preferenceField.name = key;
				preferenceField.value = '';
				preferenceFields.push(preferenceField);
				continue;
			}
			if (arr.length > 1){
				while (i < arr.length) {
					if(typeof productIterator[arr[i]] == 'undefined') {
						productIterator = '';
						break;
					}else{
						productIterator = productIterator[arr[i]];
						i++;
					}
				}
			}
			if (productIterator != null && typeof productIterator == 'object' && productIterator.hasOwnProperty('length')) {
				if (productIterator.length > 1){
					i = 0;
					while (i < productIterator.length){
						preferenceField.name = key;
						preferenceField.value = productIterator[i];
						if (arr[0] == 'custom' && (key != 'review_count' && key != 'rating_value')) {
							customFields.push(preferenceField);
						}else{
							preferenceFields.push(preferenceField);
						}
						i++;
					}
				}
			}else{
				preferenceField.name = key;
				preferenceField.value = productIterator || '';
				if (preferenceField.value == '') continue;
				if (arr[0] == 'custom' && (key != 'review_count' && key != 'rating_value')){
					customFields.push(preferenceField);
				}else{
					preferenceFields.push(preferenceField);
				}				
			}
			if (key == 'product_id'){
				hasProdId = true;
			}
		}
		preferenceField = {}
		if (!hasProdId){
			preferenceField.name = 'product_id';
			preferenceField.value = product.ID;
			preferenceFields.push(preferenceField);
		}
		attributeObject.put('fields', preferenceFields);
		attributeObject.put('customFields', customFields);
		return attributeObject;
	},
	getProductAvailability : function (product) {
		let productType = product;
		if (product.bundle){
			for each(var prod in product.bundledProducts){
				if (!prod.available){
					return 'OutOfStock';
				}
			}
		}else if (product.productSet){
			for each(var prod in product.productSetProducts){
				if (!prod.available){
					return 'OutOfStock';
				}
			}
		}else if (!product.available){
			return 'OutOfStock';
		}
		return 'InStock';
	},
	getCategoryAssignments : function (product) {
		let categories = [];
		for each(var categoryAssignment in product.categoryAssignments){
			if (this.populateCategoryTags(categoryAssignment.category).category != ''){
				categories.push(this.populateCategoryTags(categoryAssignment.category).category);
			}			
		}
		return categories;
	},
	getImageUrls : function (product) {
		let first = true,
			imageObj = {},
			altImages = [];
		if (empty(product.getImages('large')) && product.productSet){
			for each(var prod in product.productSetProducts){
				if (first){
					imageObj.mainImage = prod.getImage('large', 0).httpURL.toString();
					first = false;
					continue;
				}
				altImages.push(prod.getImage('large', 0).httpURL.toString());
			}
		}else{			
			for each(var img in product.getImages('large')){
				if (first){
					imageObj.mainImage = img.httpURL.toString();
					first = false;
					continue;
				}
				altImages.push(img.httpURL.toString());
			}
		}
		imageObj.alternates = altImages;
		return imageObj;
	},
	getPrices : function (product){
		let masterProduct = product,
			prices = {},
			priceBook;
		if (product.master){
			masterProduct = product.variationModel.defaultVariant;
		}
		if (masterProduct.productSet){
			let setPrice = 0,
				setListPrice = 0;
			for each(var productOfProductSet in masterProduct.productSetProducts){
				let productPromotions = PromotionMgr.activeCustomerPromotions.getProductPromotions(productOfProductSet);
				setPrice += productOfProductSet.variationModel.defaultVariant.priceModel.price.value;
				if (!empty(productPromotions) && productPromotions[0].getPromotionalPrice(productOfProductSet).available){
					setPrice += productPromotions[0].getPromotionalPrice(productOfProductSet).value;
				}
				setListPrice += productOfProductSet.variationModel.defaultVariant.priceModel.price.value;
			}
			prices.price = setPrice;
			prices.listPrice = setListPrice;
		}else{
			prices.price = masterProduct.priceModel.price.value;
			if (!empty(PromotionMgr.activeCustomerPromotions.getProductPromotions(product)) && PromotionMgr.activeCustomerPromotions.getProductPromotions(masterProduct)[0].getPromotionalPrice(masterProduct).available){
				prices.price = PromotionMgr.activeCustomerPromotions.getProductPromotions(masterProduct)[0].getPromotionalPrice(masterProduct).value;
			}
			priceBook = masterProduct.getPriceModel().priceInfo.priceBook;
			while (priceBook.parentPriceBook) {
				priceBook = priceBook.parentPriceBook ? priceBook.parentPriceBook : priceBook; 
			}
			prices.listPrice = masterProduct.priceModel.getPriceBookPrice(priceBook.ID);
		}
		return prices;
	},
	populateVariantAttributes : function (product) {
		let productAttributes = {};
		productAttributes.ID = product.getID();
		productAttributes.name = product.getName();
		if (!empty(PromotionMgr.activeCustomerPromotions.getProductPromotions(product)) && PromotionMgr.activeCustomerPromotions.getProductPromotions(product)[0].getPromotionalPrice(product).available){
			productAttributes.price = PromotionMgr.activeCustomerPromotions.getProductPromotions(product)[0].getPromotionalPrice(product).value;			
		}else{
			productAttributes.price =  product.priceModel.price.value;
		}
		let priceBook = product.getPriceModel().priceInfo.priceBook;
		while (priceBook.parentPriceBook) {
			priceBook = priceBook.parentPriceBook ? priceBook.parentPriceBook : priceBook; 
		}
		productAttributes.listPrice = product.getPriceModel().getPriceBookPrice(priceBook.ID);
		productAttributes.url = dw.web.URLUtils.https('Product-Show','pid', product.ID).toString();
		productAttributes.image = product.getImage('large', 0).httpURL.toString();
		productAttributes.availability = (product.available ? 'InStock' : 'OutOfStock');
		productAttributes.preferenceFields = this.populateProductAttributesFromPreference(product);
		return productAttributes;
	},
	populateCategoryTags : function (category) {
		let categoryObject = new HashMap(),
			nostoCategory = '';
		if (this.checkIfNostoBrand(category)) {
			nostoCategory = category.displayName;
		}else{
			let ArrayList = require('dw/util/ArrayList'),
				categoryList = this.getParentsForCategory(category, new ArrayList());
			if (!empty(categoryList)) {
				categoryList.reverse();
				for each(var cat in categoryList) {
					nostoCategory += '/' + cat;
				}
			}
		}
		categoryObject.put('category', nostoCategory);
		return categoryObject;
	},
	getParentsForCategory : function(category, categoryList)
    {
		let ArrayList = require('dw/util/ArrayList');
        if (categoryList == null){
        	categoryList = new ArrayList();
        }
        if (category == null){
        	return categoryList;
        }
        if (categoryList.size() == 0){
        	// add root category
        	categoryList.add(category.getDisplayName());
        }
        if(!category.online){
    		return null;
    	}
    	// exit condition for the recursion
    	if (category == null || category.getParent() == null || category.getParent().getID() == "root"){
    		return categoryList;
    	}else{
    		let parent = category.getParent();
    		categoryList.add(parent.getDisplayName());
    		return this.getParentsForCategory(parent, categoryList);
    	}
    },
    populateNostoOrderTags : function (order) {
    	let nostoOrder = new HashMap();
    	nostoOrder.put('OrderNo', order.orderNo);
    	nostoOrder.put('customer', this.getCustomerTagsFromOrder(order));
    	nostoOrder.put('lineItems', this.getLineItems(order));
    	return nostoOrder;
    },
    getCustomerTagsFromOrder : function (order) {
    	let nostoOrderCustomer = {};
    	nostoOrderCustomer.customerEmail = order.customerEmail;
    	nostoOrderCustomer.customerFirstName = order.billingAddress.firstName;
    	nostoOrderCustomer.customerLastName = order.billingAddress.lastName;
    	nostoOrderCustomer.marketingPermission = this.getMarketingPermission();
    	return nostoOrderCustomer;
    },
    getCartObject : function () {
    	let cart = BasketMgr.getCurrentOrNewBasket();
    	
    	if(empty(cart)) return null;
    	
    	var cartObject = new HashMap();
    	
    	cartObject.put("lineItems", this.getLineItems(cart));
    	
    	return cartObject;
		
    },
    getLineItems : function (cartObject) {
    	let lineItems = [],
    		lineItem = {};
    	for each(var productLineItem in cartObject.productLineItems){
    		lineItem={}
			lineItem.ID = ( (productLineItem.product.bundle || productLineItem.product.optionProduct || !productLineItem.product.variant)? productLineItem.productID : productLineItem.product.getMasterProduct().getID() );
			lineItem.sku = productLineItem.productID;
			lineItem.quantity = productLineItem.quantity.value;
			lineItem.name = productLineItem.productName;
			lineItem.unitPrice = (productLineItem.proratedPrice.value / productLineItem.quantity.value);
			lineItem.currencyCode = Site.defaultCurrency;
			lineItems.push(lineItem);
		}
    	return lineItems;
    },
    populateNostoCustomerTags : function (){
    	let customerObj = new HashMap(),
    		customerProfile = session.customer.profile;
    	customerObj.put('customerEmail', customerProfile.email);
    	customerObj.put('customerFirstName', customerProfile.firstName);
    	customerObj.put('customerLastName', customerProfile.lastName);
    	customerObj.put('customerMarketingPermission', this.getMarketingPermission());
    	return customerObj;
    },
    getCartTag : function () {
    	if(this.getEnableNostoTagging()) {
    		var cartObject = this.getCartObject();

    		if(empty(cartObject)) return "";

    		try {
    			var template = new Template('nostoCart');
        		return template.render(cartObject).getText();
    		} catch (e) {
    			this.nostoLogger('cartTag', e);
    		}
    	}
    	return "";
    },
    getProductTags : function (product) {
    	if(this.getEnableNostoTagging()) {
    		if (typeof product == 'string'){
    			product = ProductMgr.getProduct(product);
    		}
    		var productObject = this.getProductAttributes(product);
    		
    		if(empty(productObject)) return "";
    		
    		try {
    			var template = new Template('nostoPDPTags');
        		return template.render(productObject).getText();
    		} catch (e) {
    			this.nostoLogger('productTag', e);
    		}
    	}
    	return "";
    },
    getCategoryTags : function (categoryId) {
    	if(this.getEnableNostoTagging()) {
    		let category = CatalogMgr.getCategory(categoryId),
    			categoryObject = this.populateCategoryTags(category);
    		
    		if(empty(categoryObject)) return "";
    		
    		try {
    			var template = new Template('nostoCategoryTags');
        		return template.render(categoryObject).getText();        		
    		} catch (e) {
    			this.nostoLogger('categoryTag', e);
    		}
    	}
    	return "";
    },
    getOrderTags : function (order) {
    	if(this.getEnableNostoTagging()) {
    		if (typeof order == 'string'){
    			order = dw.order.OrderMgr.queryOrder("orderNo={0}", order);
    		}
    		let orderObject = this.populateNostoOrderTags(order);
    		
    		if(empty(orderObject)) return "";
    		
    		try {
    			var template = new Template('nostoOrderConfirmationTags');
        		return template.render(orderObject).getText();        		
    		} catch (e) {
    			this.nostoLogger('orderTag', e);
    		}
    	}
    	return "";
    },
    getCustomerTags : function () {
    	if(this.getEnableNostoTagging()) {
    		if (!session.customer.authenticated || request.httpPath.indexOf('COSummary-Submit') != -1 || request.httpPath.indexOf('Order-Confirm') != -1) return "";
    		
    		let customerObject = this.populateNostoCustomerTags();
    		
    		if(empty(customerObject)) return "";
    		
    		try {
    			var template = new Template('nostoCustomerTags');
        		return template.render(customerObject).getText();        		
    		} catch (e) {
    			this.nostoLogger('customerTag', e);
    		}
    	}
    	return "";
    },
    getHomePageTypeTag : function () {
    	return '<div class="nosto_page_type" style="display:none">front</div>';
    },
    getCartPageTypeTag : function () {
    	return '<div class="nosto_page_type" style="display:none">cart</div>';
    },
    nostoLogger: function (type, params) {
		var log = dw.system.Logger.getLogger("NostoInfo", "NostoInfoLog");
		log.info(type +":"+params);
	},
	getMarketingPermission : function () {
		/*
		 * 
		 *  Enter logic here.
		 *  Return only true or false
		 * 
		 */
		return false;
	}
}

// Helper method to export the helper
function getNostoHelper() {
	return nostoHelper;
}

module.exports = {
	getNostoHelper : getNostoHelper
}