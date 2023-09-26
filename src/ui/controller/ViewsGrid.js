import '../../ui/view/ViewsGrid.js';

import {
    addEvents,
    removeElemClasses,
    toggleElemClasses,
    addElemClasses,
    unitToPixel,
    pixelToUnit,
    objectHasKeys,
    fireEvent,
    deepMerge,
} from '../../helpers/utils';

import {
    getScaleByDimesions
} from '../../fabricjs/utils.js';

export default class ViewsGrid extends EventTarget {

    #maxStageSize = 1000; //when adding blank page or editing size, this will be max. canvas width/height
    #pbOffset = 50;

    constructor(fpdInstance) {

        super();

        this.fpdInstance = fpdInstance;
        this.unitFormat = fpdInstance.mainOptions.dynamicViewsOptions.unit;
		this.formats = fpdInstance.mainOptions.dynamicViewsOptions.formats;
		this.minWidth = fpdInstance.mainOptions.dynamicViewsOptions.minWidth;
		this.minHeight = fpdInstance.mainOptions.dynamicViewsOptions.minHeight;
		this.maxWidth = fpdInstance.mainOptions.dynamicViewsOptions.maxWidth;
		this.maxHeight = fpdInstance.mainOptions.dynamicViewsOptions.maxHeight;
		this.currentLayouts = [];        

        this.container = document.createElement("fpd-views-grid");
        fpdInstance.container.append(this.container);

        toggleElemClasses(
            fpdInstance.container,
            ['fpd-dynamic-views-enabled'],
            fpdInstance.mainOptions.enableDynamicViews
        )

        this.gridElem = this.container.querySelector('.fpd-grid');
        this.blankPageModal = this.container.querySelector('.fpd-blank-page-modal');
        this.layoutsModal = this.container.querySelector('.fpd-layouts-modal');
        
        if(fpdInstance.mainOptions.enableDynamicViews) {

            this.blankPageCustomWidthInput = this.blankPageModal.querySelectorAll('.fpd-head input')[0];
            this.blankPageCustomHeightInput = this.blankPageModal.querySelectorAll('.fpd-head input')[1];
            this.blankPageCustomWidthInput.setAttribute('placeholder', this.unitFormat);
            this.blankPageCustomHeightInput.setAttribute('placeholder', this.unitFormat);

            if(Array.isArray(this.formats) && this.formats.length) {

                removeElemClasses(
                    this.container.querySelector('.fpd-btn.fpd-add-blank'),
                    ['fpd-hidden']
                )

                this.formats.forEach( format => {

                    const formatWidth = format[0];
                    const formatHeight = format[1];

                    const itemSize = 150;
                    let itemWidth, itemHeight;
                    if(formatWidth > formatHeight) {

                        itemWidth = itemSize;
                        itemHeight = (itemSize / formatWidth) * formatHeight;

                    }
                    else {

                        itemHeight = itemSize;
                        itemWidth = (itemSize / formatHeight) * formatWidth;

                    }

                    const formatItem = document.createElement('div');
                    formatItem.className = 'fpd-shadow-1 fpd-item';
                    formatItem.innerHTML = '<span>'+formatWidth+'x'+formatHeight+'<br>'+this.unitFormat+'</span>';
                    formatItem.style.width = itemWidth+'px';
                    formatItem.style.height = itemHeight+'px';
                    this.blankPageModal.querySelector('.fpd-grid').append(formatItem);

                    addEvents(
                        formatItem,
                        'click',
                        (evt) => {
                            
                            this.#addBlankPage(formatWidth, formatHeight);

                        }
                    )

                })

            }

            let startIndex;
            AreaSortable('unrestricted', {
                container: this.gridElem,
                handle: 'fpd-sort',
                item: 'fpd-item',
                placeholder: 'fpd-sortable-placeholder',
                activeItem: 'fpd-sortable-dragged',
                closestItem: 'fpd-sortable-closest',
                autoscroll: true,
                animationMs: 0,
                onStart: (item) => {

                    startIndex = Array.from(this.gridElem.querySelectorAll('.fpd-item')).indexOf(item);
                                    
                    // disable scroll
                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;
                    window.onscroll = () => {
                        window.scrollTo({top: scrollTop})
                    };
                    
                    
                },
                onEnd: (item)=> {

                    const endIndex = Array.from(this.gridElem.querySelectorAll('.fpd-item')).indexOf(item);

                    if(startIndex != endIndex) {
                        
                        this.#array_move(fpdInstance.viewInstances, startIndex, endIndex);
                        fpdInstance.productStage.innerHTML = '';
                        fpdInstance.viewInstances.forEach(viewInst => {

                            fpdInstance.productStage.append(viewInst.fabricCanvas.wrapperEl)
                            
                        })

                        /**
                         * Gets fired when a view is moved into a new position.
                         *
                         * @event viewMove
                         * @param {Event} event
                         */
                        fireEvent(fpdInstance, 'viewMove')

                        fpdInstance.selectView(0);

                    }
                    
                    window.onscroll = () => {};                
                    
                }

            });

            addEvents(
                this.container.querySelectorAll('.fpd-btn.fpd-add-blank, .fpd-btn.fpd-add-layout'),
                'click',
                (evt) => {

                    addElemClasses(
                        this.container,
                        ['fpd-modal-visible']
                    )

                    if(evt.currentTarget.classList.contains('fpd-add-blank')) {
                        
                        removeElemClasses(
                            this.blankPageModal,
                            ['fpd-hidden']
                        )

                    }
                    else {
                        
                        removeElemClasses(
                            this.layoutsModal,
                            ['fpd-hidden']
                        )

                    }
    
                }
            )

            addEvents(
                this.container.querySelectorAll('.fpd-blank-page-modal .fpd-close, .fpd-layouts-modal .fpd-close'),
                'click',
                () => {

                    removeElemClasses(
                        this.container,
                        ['fpd-modal-visible']
                    )
                    
                    addElemClasses(
                        this.blankPageModal,
                        ['fpd-hidden']
                    )
                    
                    addElemClasses(
                        this.layoutsModal,
                        ['fpd-hidden']
                    )
    
                }
            )

            addEvents(
                fpdInstance,
                'layoutsSet',
                () => {

                    toggleElemClasses(
                        this.container.querySelectorAll('.fpd-btn.fpd-add-layout'),
                        ['fpd-hidden'],
                        !(fpdInstance.currentLayouts && fpdInstance.currentLayouts.length > 0)
                    )

                    if(fpdInstance.currentLayouts && fpdInstance.currentLayouts.length) {

                        fpdInstance.currentLayouts.forEach( layout => {

                            const layoutItem = document.createElement('div');
                            layoutItem.className = 'fpd-shadow-1 fpd-item';
                            layoutItem.innerHTML = '<picture  style="background-image: url(' + layout.thumbnail + ');"></picture><span>'+layout.title+'</span>'
                            this.layoutsModal.querySelector('.fpd-grid').append(layoutItem);

                            addEvents(
                                layoutItem,
                                'click',
                                (evt) => {

                                    fpdInstance.addView(layout);
                                    this.hideModals();

                                }
                            )

                        })

                    }

                }
            )

            addEvents(
                this.blankPageModal.querySelector('.fpd-head .fpd-btn'),
                'click', 
                (evt) => {

                    if(this.blankPageCustomWidthInput.value && this.blankPageCustomHeightInput.value) {

                        const width = parseInt(Math.abs(this.blankPageCustomWidthInput.value));
                        const height = parseInt(Math.abs(this.blankPageCustomHeightInput.value));

                        this.#addBlankPage(width, height)
                        
                    }
                    
                    

                }
            )
            
            this.blankPageModal.querySelector('.fpd-input input[data-type="width"]').value = this.minWidth;
            this.blankPageModal.querySelector('.fpd-input input[data-type="height"]').value = this.minHeight;
            addEvents(
                this.blankPageModal.querySelectorAll('.fpd-input input'),
                'keyup',
                (evt) => {

                    evt.currentTarget.value = this.#checkDimensionLimits(evt.currentTarget.dataset.type, evt.currentTarget);

                }
            )

        }

        addEvents(
            fpdInstance,
            'viewCreate',
            (evt) => {

                const viewInstance = evt.detail.viewInstance;
                const viewImageURL = FancyProductDesigner.proxyFileServer ? FancyProductDesigner.proxyFileServer + viewInstance.thumbnail : viewInstance.thumbnail;

                const viewItem = document.createElement('div');
                viewItem.className = 'fpd-shadow-1 fpd-item';
                viewItem.title = viewInstance.title;
                viewItem.innerHTML = '<picture style="background-image: url(' + viewImageURL + ');"></picture><span>'+viewItem.title+'</span>';
                this.gridElem.append(viewItem);

                if(fpdInstance.mainOptions.enableDynamicViews) {

                    const sortElem = document.createElement('div');
                    sortElem.className = 'fpd-sort';
                    sortElem.innerHTML = '<span class="fpd-icon-drag"></span>';
                    viewItem.append(sortElem);

                    const optionsElem = document.createElement('div');
                    optionsElem.className = 'fpd-options';
                    optionsElem.innerHTML = '···';
                    viewItem.append(optionsElem);

                    const dropdownMenu = document.createElement('div');
                    dropdownMenu.className = 'fpd-dropdown-menu fpd-shadow-1';
                    dropdownMenu.innerHTML = `
                        <span data-option="edit-size">${fpdInstance.translator.getTranslation('misc', 'view_edit_size')}</span>
                        <span data-option="duplicate">${fpdInstance.translator.getTranslation('misc', 'view_duplicate')}</span>
                        <span data-option="delete">${fpdInstance.translator.getTranslation('misc', 'view_delete')}</span>
                    `;
                    optionsElem.append(dropdownMenu);

                    let viewWidthUnit = pixelToUnit(viewInstance.options.stageWidth, this.unitFormat),
					    viewHeightUnit = pixelToUnit(viewInstance.options.stageHeight, this.unitFormat);

                               //check if canvas output is set
                    if(objectHasKeys(viewInstance.options.output, ['width', 'height'])) {
                        viewWidthUnit = viewInstance.options.output.width;
                        viewHeightUnit = viewInstance.options.output.height;                        
                    }
                    
                    const editSizeOverlay = document.createElement('div');
                    editSizeOverlay.className = 'fpd-edit-size-overlay';
                    editSizeOverlay.innerHTML = `
                        <input type="number" data-type="width" step=1 min=${this.minWidth} max=${this.maxWidth} value=${viewWidthUnit} />
                        <input type="number" data-type="height" step=1 min=${this.minHeight} max=${this.maxHeight} value=${viewHeightUnit} />
                        <span class="fpd-btn"><span class="fpd-icon-done"></span></span>
                        <span class="fpd-btn fpd-secondary"><span class="fpd-icon-close"></span></span>
                    `;

                    viewItem.append(editSizeOverlay);

                    //change size of view canvas
                    addEvents(
                        editSizeOverlay.querySelectorAll('.fpd-btn'),
                        'click',
                        (evt) => {

                            if(!evt.currentTarget.classList.contains('fpd-secondary')) {

                                let widthPx = unitToPixel(editSizeOverlay.querySelector('[data-type="width"]').value, this.unitFormat),
                                heightPx = unitToPixel(editSizeOverlay.querySelector('[data-type="height"]').value, this.unitFormat);
                                
                                let viewOptions = this.#calcPageOptions(widthPx, heightPx);
                                viewInstance.options = deepMerge(viewInstance.options, viewOptions);                            
                                viewInstance.fabricCanvas.viewOptions = viewInstance.options;

                                viewInstance.fabricCanvas._renderPrintingBox();
                                if(viewInstance == this.fpdInstance.currentViewInstance) {
                                    viewInstance.fabricCanvas.resetSize();
                                }
                                
                                this.#doPricing(viewInstance);

                                this.reset();

                            }

                            removeElemClasses(editSizeOverlay, ['fpd-show']);
                            
                            
                        }
                    )
                    
                    //limits of changing view size
                    addEvents(
                        editSizeOverlay.querySelectorAll('input'),
                        'keyup',
                        (evt) => {

                            const inputElem = evt.currentTarget;
                            
                            if(inputElem.dataset.type == 'width') {

                                this.#checkDimensionLimits('width', inputElem);
                                this.#checkDimensionLimits('height', inputElem.nextElementSibling);
                
                            }
                            else {
                
                                this.#checkDimensionLimits('height', inputElem);
                               this.#checkDimensionLimits('width', inputElem.previousElementSibling)
                
                            }                            
                            
                        }
                    )

                    addEvents(
                        optionsElem,
                        'click',
                        (evt) => {

                            evt.stopPropagation(); 

                            const dropdownMenu = optionsElem.querySelector('.fpd-dropdown-menu');

                            toggleElemClasses(
                                dropdownMenu,
                                ['fpd-show'],
                                !dropdownMenu.classList.contains('fpd-show')
                            )  
                                                     

                        }
                    )

                    addEvents(
                        dropdownMenu.querySelectorAll('span'),
                        'click',
                        (evt) => {

                            const option = evt.currentTarget.dataset.option;

                            if(option == 'edit-size') {

                                addElemClasses(editSizeOverlay, ['fpd-show'])  

                            }
                            else if(option == 'duplicate') {

                                this.#duplicateView(viewInstance);

                            }
                            else if(option == 'delete') {

                                const viewIndex = Array.from(this.gridElem.querySelectorAll('.fpd-item')).indexOf(viewItem);
			                    fpdInstance.removeView(viewIndex);

                            }                        

                        }
                    )

                    this.#doPricing(viewInstance);
                    
                }
                
                addEvents(
                    viewItem.querySelector('picture'),
                    'click',
                    (evt) => {
                    
                        const viewIndex = Array.from(this.gridElem.querySelectorAll('.fpd-item')).indexOf(viewItem);

                        fpdInstance.selectView(viewIndex);
                        
                        this.reset();

                    }
                )
            }
        )

        addEvents(
            fpdInstance,
            'viewRemove',
            (evt) => {
                
                const viewItem = this.gridElem.querySelectorAll('.fpd-item').item(evt.detail.viewIndex);                
                if(viewItem)
                    viewItem.remove();                        

            }

        )

        addEvents(
            fpdInstance,
            'clear',
            () => {
                            
                this.gridElem.innerHTML = '';

            }
        )

        addEvents(
            this.container.querySelector('.fpd-close'),
            'click',
            this.reset.bind(this)
        )

        addEvents(
            fpdInstance,
            'navItemSelect',
            this.reset.bind(this)
        )

    }

    #calcPageOptions(widthPx, heightPx) {

        let aspectRatio = Math.min((this.#maxStageSize - this.#pbOffset) / widthPx,  (this.#maxStageSize - this.#pbOffset) / heightPx);
        const pbWidth = parseInt(widthPx * aspectRatio);
        const pbHeight = parseInt(heightPx * aspectRatio);

        let viewOptions = {
            stageWidth: pbWidth+this.#pbOffset,
            stageHeight: pbHeight+this.#pbOffset,
            printingBox: {
                width: pbWidth,
                height: pbHeight,
                left: ((pbWidth+this.#pbOffset) / 2) - (pbWidth / 2),
                top: ((pbHeight+this.#pbOffset) / 2) - (pbHeight / 2),
                visibility: true
            },
            usePrintingBoxAsBounding: true,
            output: {
                width: pixelToUnit(widthPx, 'mm'),
                height: pixelToUnit(heightPx, 'mm')
            }
        };

        return viewOptions;

    }   

    #doPricing(viewInstance) {
        
        if(viewInstance && this.fpdInstance.mainOptions.dynamicViewsOptions.pricePerArea) {

            let width = pixelToUnit(viewInstance.options.stageWidth, 'cm'),
                height = pixelToUnit(viewInstance.options.stageHeight, 'cm');

            //check if canvas output is set
            if(objectHasKeys(viewInstance.options.output, ['width', 'height'])) {
                width = viewInstance.options.output.width / 10;
                height = viewInstance.options.output.height / 10;                
            }

            let cm2 = Math.ceil(width * height),
                cm2Price = cm2 * Number(this.fpdInstance.mainOptions.dynamicViewsOptions.pricePerArea);
                            
            viewInstance.changePrice(0, '+', cm2Price);

        }

    }

    #addBlankPage(width, height) {

        if(!width || !height) return;
        
        const widthPx = unitToPixel(Number(width), this.unitFormat);
        const heightPx = unitToPixel(Number(height), this.unitFormat);

        let viewOptions = this.#calcPageOptions(widthPx, heightPx);
        this.fpdInstance.addView({
            title: width+'x'+height,
            thumbnail: '',
            elements: [],
            options: viewOptions
        });

        this.hideModals();

    }

    #duplicateView(viewInstance) {
        
        let viewElements = viewInstance.fabricCanvas.getObjects(),
            jsonViewElements = [];

        viewElements.forEach(element => {
            
            if(element.title !== undefined && element.source !== undefined) {

                const jsonItem = {
                    title: element.title,
                    source: element.source,
                    parameters: element.getElementJSON(),
                    type: element.getType()
                };

                jsonViewElements.push(jsonItem);
            }

        });                                

        this.fpdInstance.addView({
            title: viewInstance.title,
            thumbnail: viewInstance.thumbnail,
            elements: jsonViewElements,
            options: viewInstance.options
        });

    }

    #array_move(arr, fromIndex, toIndex) {

	    let element = arr[fromIndex];
		arr.splice(fromIndex, 1);
	    arr.splice(toIndex, 0, element);
	}

    #checkDimensionLimits(type, input) {

		if(type == 'width') {

			if(input.value < this.minWidth) { input.value = this.minWidth; }
			else if(input.value > this.maxWidth) { input.value = this.maxWidth; }

		}
		else {

			if(input.value < this.minHeight) { input.value = this.minHeight; }
			else if(input.value > this.maxHeight) { input.value = this.maxHeight; }

		}        

		return input.value;

	}

    hideModals() {

        removeElemClasses(
            this.container,
            ['fpd-modal-visible']
        )
        
        addElemClasses(
            this.blankPageModal,
            ['fpd-hidden']
        )
        
        addElemClasses(
            this.layoutsModal,
            ['fpd-hidden']
        )

    }

    reset() {

        this.hideModals();
        removeElemClasses(this.container, ['fpd-show']);

    }

}