window.RevealImage = window.RevealImage || {
    id: "image",
    init: (deck) => {
        const ClickeventArray = [
            ".crop-image",
            ".horizontal-flip-image",
            ".vertical-flip-image",
            ".crop-Done",
            ".add-theme-image",
            ".image-replace",
            ".image-replace-icon",
        ];
        // Remember the last interacted block to disambiguate selection with overlapping images
        let __lastBlockId = null;
        $(document).on('mousedown', '.sl-block', function() {
            try { __lastBlockId = $(this).data('id'); } catch (_) {}
        });
        // Observe focused class changes to keep the last focused block id current
        try {
            const mo = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    if (m.type === 'attributes' && m.attributeName === 'class') {
                        const el = m.target;
                        if (el.classList && el.classList.contains('sl-block') && el.classList.contains('focused')) {
                            const id = $(el).data('id');
                            if (typeof id !== 'undefined') __lastBlockId = id;
                        }
                    }
                }
            });
            mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class'] });
        } catch (err) {}
        // Also track clicks on the image element inside the block
        $(document).on('mousedown', '.sl-block .sl-block-content .sl-block-element', function() {
            try { __lastBlockId = $(this).closest('.sl-block').data('id'); } catch (_) {}
        });
        var isDragcrop = false;
        var isResizecrop = false;
        var mouseMovedcrop = false;
        var dragBlockcrop;
        var startXcrop, startYcrop;
        var startLeftcrop, startTopcrop;
        var startWidthcrop, startHeightcrop, containercrop;
        /**
         * Attaches a click event handler to the specified elements and performs different actions based on the triggered class or ID.
         * @param {string} ClickeventArray - An array of CSS classes or IDs to attach the click event to.
         * @param {function} e - The event object.
         * @returns None
         */
        $(document).on("click", ClickeventArray.join(","), function (e) {
            // Find the class that triggered the event
            let triggeredClass = $(e.currentTarget)
                .attr("class")
                .split(" ")
                .find((className) => ClickeventArray.includes("." + className));
            switch (triggeredClass || $(this).attr("id")) {
                case "crop-image":
                    CropImage(e, this);
                    break;
                case "horizontal-flip-image":
                    HorizontalFlipImage(e, this);
                    break;
                case "vertical-flip-image":
                    VerticalFlipImage(e, this);
                    break;
                case "crop-Done":
                    CropComplete(e, this);
                    break;
                case "add-theme-image":
                    addThemeImage(e, this);
                    break;
                case "image-replace":
                    console.log("image-replace");
                    updateReplaceimage();
                    break;
                 case "image-replace-icon":
                    console.log("image-replace-icon");
                    updateReplaceimageIcon();
                    break;
                default:
                    break;
            }
        });

        /**
         * Function to crop an image within a container element.
         * @param {Event} e - The event object.
         * @param {HTMLElement} that - The element that triggered the event.
         * @returns None
         */
        CropImage = function (e, that) {
            // Ensure only one crop overlay exists at a time
            try {
                $(".Crop-Container").remove();
                $(".sl-block.image-croping").removeClass("image-croping");
            } catch (_) {}
            // Prefer last clicked block id if present; otherwise focused
            if (__lastBlockId) {
                let $byId = getCurrentElementById(__lastBlockId);
                if ($byId && $byId.length) {
                    currentTarget = $byId;
                } else {
                    currentTarget = getCurrentElement();
                }
            } else {
                currentTarget = getCurrentElement();
            }
            currentElement = currentTarget.children('.sl-block-content').children('.sl-block-element').first();
            Left = parseFloat(currentTarget[0].style.left);
            Top = parseFloat(currentTarget[0].style.top);
            var positionInfo = currentTarget[0].getBoundingClientRect();

            currentTarget.addClass("image-croping");
            // Raise z-index during cropping and remember previous
            try {
                const prevZ = currentTarget.css('z-index');
                currentTarget.attr('data-prev-z', prevZ || '');
                currentTarget.css('z-index', 999);
            } catch (err) {}
            var $cropContainer = $("<div>", {
                class: "Crop-Container",
            });
            // Tag this overlay with the target element id to keep operations scoped
            try {
                var _forId = currentTarget.data("id");
                if (_forId !== undefined) {
                    $cropContainer.attr("data-for-id", _forId);
                }
            } catch (err) {}
            var $imageContainer = $("<div>", {
                class: "image-Container",
            });
            var $cropblock = $("<div>", {
                class: "sl-crop-block",
            });
            $cropblock.append($imageContainer);
            $cropContainer.append($cropblock);
            var $anchorwrapper = $("<div>", {
                class: "anchor-wrapper",
            });
            $anchorwrapper.append(`<div class="Cropanchor" data-direction="n"></div>
                <div class="Cropanchor" data-direction="e"></div>
                <div class="Cropanchor" data-direction="s"></div>
                <div class="Cropanchor" data-direction="w"></div>
                <div class="Cropanchor" data-direction="nw">
                    <div class="Cropanchor-point"></div>
                </div>
                <div class="Cropanchor" data-direction="ne">
                    <div class="Cropanchor-point"></div>
                </div>
                <div class="Cropanchor" data-direction="se">
                    <div class="Cropanchor-point"></div>
                </div>
                <div class="Cropanchor" data-direction="sw">
                    <div class="Cropanchor-point"></div>
            </div>`);
            $cropblock.append($anchorwrapper);
            var $imagecroppreview = $("<img>", {
                src: currentElement.attr("src"),
                class: "image-crop-preview",
            });
            $imagecroppreview.attr("draggable", "false");
            $imageContainer.append($imagecroppreview);

            if (!(currentTarget.attr("data-croped") === "true")) {
                // First-time crop: mirror the block's rect and set anchors to full size at (0,0)
                $cropblock.css(
                    currentTarget.css(["width", "height", "top", "left"]) 
                );
                $anchorwrapper.css(currentTarget.css(["width", "height"]));
                $anchorwrapper.css({ top: "0px", left: "0px" });
            } else {
                currentElementtop = isNaN(parseInt(currentElement[0].style.top))
                    ? 0
                    : parseInt(currentElement[0].style.top);
                currentElementleft = isNaN(
                    parseInt(currentElement[0].style.left)
                )
                    ? 0
                    : parseInt(currentElement[0].style.left);
                $cropblock.css(currentElement.css(["width", "height"]));
                $cropblock.css({
                    top:
                        parseInt(currentTarget[0].style.top) +
                        currentElementtop +
                        "px",
                    left:
                        parseInt(currentTarget[0].style.left) +
                        currentElementleft +
                        "px",
                });
                $anchorwrapper.css(currentTarget.css(["width", "height"]));
                $anchorwrapper.css({
                    top: currentElementtop * -1 + "px",
                    left: currentElementleft * -1 + "px",
                });
            }

            currentTarget.after($cropContainer);
            $(that).hide();
            $(".crop-Done").show();
        };
        /**
         * Function to horizontally flip image within a container element.
         * @param {Event} e - The event object.
         * @param {HTMLElement} that - The element that triggered the event.
         * @returns None
         */
        HorizontalFlipImage = function (e, that) {
            var currentTarget = getCurrentElement();
            var currentElement = currentTarget.children('.sl-block-content').children('.sl-block-element').first();
            var transform = currentElement.css("transform");

            // Get current transformations
            var scaleX = 1, scaleY = 1;
            if (transform !== "none") {
            var matrix = transform.match(
                /^matrix\((-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+)\)$/
            );
            if (matrix) {
                scaleX = parseFloat(matrix[1]);
                scaleY = parseFloat(matrix[4]);
            }
            }

            // Toggle horizontal flip
            scaleX = scaleX === 1 ? -1 : 1;

            // Apply the transformation preserving vertical flip state
            currentElement.css({
            transform: `scale(${scaleX}, ${scaleY})`,
            left:
                (parseInt(currentElement[0].style.width) -
                parseInt(currentTarget[0].style.width) -
                parseInt(currentElement[0].style.left) * -1) *
                -1,
            });
            
            currentTarget.attr("data-flip", scaleX === -1 || scaleY === -1);
            $(document).trigger("elementeupdate");
        };

        /**
         * Function to vertically flip image within a container element.
         * @param {Event} e - The event object.
         * @param {HTMLElement} that - The element that triggered the event.
         * @returns None
         */
        VerticalFlipImage = function (e, that) {
            var currentTarget = getCurrentElement();
            var currentElement = currentTarget.children('.sl-block-content').children('.sl-block-element').first();
            var transform = currentElement.css("transform");

            // Get current transformations
            var scaleX = 1, scaleY = 1;
            if (transform !== "none") {
            var matrix = transform.match(
                /^matrix\((-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+)\)$/
            );
            if (matrix) {
                scaleX = parseFloat(matrix[1]);
                scaleY = parseFloat(matrix[4]);
            }
            }

            // Toggle vertical flip
            scaleY = scaleY === 1 ? -1 : 1;

            // Apply the transformation preserving horizontal flip state
            currentElement.css({
            transform: `scale(${scaleX}, ${scaleY})`,
            top:
                (parseInt(currentElement[0].style.height) -
                parseInt(currentTarget[0].style.height) -
                parseInt(currentElement[0].style.top) * -1) *
                -1,
            });
            
            currentTarget.attr("data-flip", scaleX === -1 || scaleY === -1);
            $(document).trigger("elementeupdate");
        };

        /**
         * Function to apply both horizontal and vertical flips to an image.
         * @param {Event} e - The event object.
         * @param {HTMLElement} that - The element that triggered the event.
         * @returns None
         */
        BothFlipImage = function (e, that) {
            var currentTarget = getCurrentElement();
            var currentElement = currentTarget.children('.sl-block-content').children('.sl-block-element').first();
            var transform = currentElement.css("transform");

            // Get current transformations
            var scaleX = 1, scaleY = 1;
            if (transform !== "none") {
            var matrix = transform.match(
                /^matrix\((-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+)\)$/
            );
            if (matrix) {
                scaleX = parseFloat(matrix[1]);
                scaleY = parseFloat(matrix[4]);
            }
            }

            // Toggle both flips
            if (scaleX === 1 && scaleY === 1) {
            scaleX = -1;
            scaleY = -1;
            } else {
            scaleX = 1;
            scaleY = 1;
            }

            // Apply the transformation
            currentElement.css({
            transform: `scale(${scaleX}, ${scaleY})`,
            left:
                (parseInt(currentElement[0].style.width) -
                parseInt(currentTarget[0].style.width) -
                parseInt(currentElement[0].style.left) * -1) *
                -1,
            top:
                (parseInt(currentElement[0].style.height) -
                parseInt(currentTarget[0].style.height) -
                parseInt(currentElement[0].style.top) * -1) *
                -1,
            });
            
            currentTarget.attr("data-flip-h", scaleX === -1);
            currentTarget.attr("data-flip-v", scaleY === -1);
            $(document).trigger("elementeupdate");
        };

        /**
         * Completes the cropping process for an image element.
         * @param {Event} e - The event object.
         * @param {Object} that - The reference to the current object.
         * @returns None
         */
        CropComplete = function (e, that) {
            // Resolve active overlay first
            let $overlay = $(".Crop-Container").first();
            // Derive the exact block: the overlay is inserted immediately after the target block
            let currentTarget = ($overlay && $overlay.length) ? $overlay.prev('.sl-block') : $();
            if (!currentTarget || !currentTarget.length) {
                // Fallback by id mapping
                if ($overlay && $overlay.length && $overlay.attr('data-for-id')) {
                    const oid = $overlay.attr('data-for-id');
                    const $byId = getCurrentElementById(oid);
                    if ($byId && $byId.length) currentTarget = $byId;
                }
            }
            if (!currentTarget || !currentTarget.length) {
                currentTarget = getCurrentElement();
            }
            // Target only the immediate element inside this block
            let currentElement = currentTarget.children('.sl-block-content').children('.sl-block-element').first();
            // Capture pre-crop geometry in case we need to revert
            const prev = {
                target: {
                    width: currentTarget.outerWidth(),
                    height: currentTarget.outerHeight(),
                    top: parseFloat(currentTarget[0].style.top || $(currentTarget).css("top") || 0) || 0,
                    left: parseFloat(currentTarget[0].style.left || $(currentTarget).css("left") || 0) || 0,
                },
                elem: {
                    width: currentElement.outerWidth(),
                    height: currentElement.outerHeight(),
                    top: parseFloat(currentElement[0].style.top || $(currentElement).css("top") || 0) || 0,
                    left: parseFloat(currentElement[0].style.left || $(currentElement).css("left") || 0) || 0,
                }
            };
            // Ensure we have an overlay reference
            if (!$overlay || !$overlay.length) {
                $overlay = $(".Crop-Container").first();
            }

            if (!$overlay || !$overlay.length) {
                console.warn("CropComplete: No crop overlay found for current element.");
                return;
            }
            let $anchorwrapper = $overlay.find(".anchor-wrapper");
            let $cropblock = $overlay.find(".sl-crop-block");

            // Guard against missing inner nodes
            if (!$anchorwrapper.length || !$cropblock.length) {
                $overlay.remove();
                currentTarget.removeClass("image-croping");
                // Restore previous z-index if any
                const prevZ = currentTarget.attr('data-prev-z');
                if (typeof prevZ !== 'undefined') {
                    if (prevZ === '') { currentTarget.css('z-index', ''); }
                    else { currentTarget.css('z-index', prevZ); }
                    currentTarget.removeAttr('data-prev-z');
                }
                $(that).hide();
                $(".crop-image").show();
                return;
            }

            // Safely compute dimensions and positions
            let awWidth = Math.round($anchorwrapper.outerWidth());
            let awHeight = Math.round($anchorwrapper.outerHeight());
            let cbWidth = Math.round($cropblock.outerWidth());
            let cbHeight = Math.round($cropblock.outerHeight());

            // Clamp to at least 1px to avoid zero-sized elements
            if (!awWidth || awWidth < 1) awWidth = 1;
            if (!awHeight || awHeight < 1) awHeight = 1;
            if (!cbWidth || cbWidth < 1) cbWidth = awWidth; // fallback to block width
            if (!cbHeight || cbHeight < 1) cbHeight = awHeight; // fallback to block height

            const awTop = parseFloat($anchorwrapper[0].style.top || 0) || 0;
            const awLeft = parseFloat($anchorwrapper[0].style.left || 0) || 0;
            const cbTop = parseFloat($cropblock[0].style.top || 0) || 0;
            const cbLeft = parseFloat($cropblock[0].style.left || 0) || 0;

            // Apply dimensions using explicit px strings to avoid computed width inconsistencies
            currentTarget.css({ width: awWidth + 'px', height: awHeight + 'px' });
            currentElement.css({ width: cbWidth + 'px', height: cbHeight + 'px' });

            // Apply positions: inner img offset is negative of anchorwrapper offset
            currentElement.css({
                position: 'absolute',
                top: (-awTop) + "px",
                left: (-awLeft) + "px",
                visibility: 'visible',
                opacity: 1,
                display: 'block'
            });
            currentTarget.css({
                top: (awTop + cbTop),
                left: (awLeft + cbLeft),
            });

            // Ensure the content masks the inner image rather than “vanishing”
            const $content = currentTarget.children('.sl-block-content');
            if ($content.length) {
                $content.css({ overflow: 'hidden', position: 'relative', width: '100%', height: '100%' });
            }

            // If somehow computed sizes are invalid, revert to previous safe state
            const appliedTargetW = currentTarget.outerWidth();
            const appliedTargetH = currentTarget.outerHeight();
            if (!appliedTargetW || !appliedTargetH) {
                currentTarget.css({ top: prev.target.top, left: prev.target.left });
                currentTarget.width(prev.target.width).height(prev.target.height);
                currentElement.css({ top: prev.elem.top, left: prev.elem.left });
                currentElement.width(prev.elem.width).height(prev.elem.height);
            }

            // Remove only this element's overlay
            // Cleanup overlay and state
            if ($overlay && $overlay.remove) $overlay.remove();
            currentTarget.attr("data-croped", "true");
            currentTarget.removeClass("image-croping");
            // Restore previous z-index if any
            const prevZ = currentTarget.attr('data-prev-z');
            if (typeof prevZ !== 'undefined') {
                if (prevZ === '') { currentTarget.css('z-index', ''); }
                else { currentTarget.css('z-index', prevZ); }
                currentTarget.removeAttr('data-prev-z');
            }
            $(that).hide();
            $(".crop-image").show();
            try {
                $(document).trigger("elementeupdate");
            } catch (err) {
                console.warn("CropComplete: elementeupdate trigger failed", err);
            }
        };

        $("body").on("mousedown", ".anchor-wrapper", function (event) {
            if (event.originalEvent.target.className == "anchor-wrapper") {
                isDragcrop = true;
                dragBlockcrop = $(this);
                startXcrop = event.pageX;
                // Use the specific wrapper being dragged; default to 0 if unset
                startLeftcrop = parseFloat(this.style.left);
                if (isNaN(startLeftcrop)) startLeftcrop = 0;
                startTopcrop = parseFloat(this.style.top);
                if (isNaN(startTopcrop)) startTopcrop = 0;
                startYcrop = event.pageY;
                startWidthcrop = $(this).outerWidth();
                startHeightcrop = $(this).outerHeight();

                var eventData = {
                    // Pass the specific instance to keep move/resize scoped
                    instance: $(this),
                    target: this,
                };
                $(".reveal").bind("mouseup", eventData, mouserelesecrop);
                $(".reveal").bind("mousemove", eventData, mousemovecrop);
            }
        });
        $("body").on("mousedown", ".Cropanchor", function (event) {
            if (event.originalEvent.target.className == "Cropanchor") {
                isDragcrop = false;
                isResizecrop = true;
                startYcrop = event.clientY;
                startTopcrop = $(this).closest(".anchor-wrapper").offset().top;
                startXcrop = event.clientX;
                startLeftcrop = $(this).closest(".anchor-wrapper").offset().left;
                startWidthcrop = $(this).closest(".anchor-wrapper").outerWidth();
                startHeightcrop = $(this).closest(".anchor-wrapper").outerHeight();
                var eventData = {
                    // Scope to the wrapper that owns this handle
                    instance: $(this).closest(".anchor-wrapper"),
                    target: this,
                };
                $(".reveal").bind("mouseup", eventData, mouserelesecrop);
                $(".reveal").bind("mousemove", eventData, mousemovecrop);
            }
        });

        /**
         * Handles the mousemove event for resizing and dragging crop area.
         * @param {Event} event - The mousemove event object.
         * @returns None
         */
        mousemovecrop = function (event) {
            //event.preventDefault();
            mouseMovedcrop = true;
            element = event.data.instance; // jQuery of the specific .anchor-wrapper
            target = event.data.target;
            let parent = element;
            dragscale = Reveal.getScale();
            // Use the image container associated with this overlay only
            containercrop = element.closest(".Crop-Container").find(".image-Container");
            containerheight = containercrop[0].getBoundingClientRect().height;
            containerwidth = containercrop[0].getBoundingClientRect().width;
            let deltaX = (startXcrop - event.clientX) / dragscale;
            let deltaY = (startYcrop - event.clientY) / dragscale;

            if (isDragcrop) {
                // Calculate the relative position to the slides
                let x = (event.pageX - startXcrop) / dragscale + startLeftcrop;
                let y = (event.pageY - startYcrop) / dragscale + startTopcrop;
                // Make sure the element doesn't move outside the parent slides
                x = Math.min(
                    Math.max(x, 0),
                    containercrop.width() - dragBlockcrop.outerWidth()
                );
                y = Math.min(
                    Math.max(y, 0),
                    containercrop.height() - dragBlockcrop.outerHeight()
                );

                dragBlockcrop.css({
                    top: y,
                    left: x,
                });
            } else if (isResizecrop) {
                let dot = $(target);
                let newheight = 0;
                let newWidth = 0;
                if (dot.data("direction") === "se") {
                    if (
                        event.clientX <
                        containercrop.offset().left + containerwidth
                    ) {
                        if (
                            parent.position().left + parent.width() <
                                containercrop.width() ||
                            deltaX > 0
                        ) {
                            newWidth = startWidthcrop - deltaX;
                        }
                    }
                    if (
                        event.clientY <
                        containercrop.offset().top + containerheight
                    ) {
                        if (
                            (parent.position().top + parent.height() <
                                containercrop.height() &&
                                parent.position().left + parent.width() <
                                    containercrop.width()) ||
                            deltaY > 0
                        ) {
                            newheight = startHeightcrop - deltaY;
                        }
                    }
                } else if (dot.data("direction") === "sw") {
                    if (event.clientX > containercrop.offset().left) {
                        if (
                            parent.position().left + parent.width() <
                                containercrop.width() ||
                            deltaX < 0
                        ) {
                            newWidth = startWidthcrop + deltaX;
                            parent.offset({
                                left:
                                    startLeftcrop -
                                    (startXcrop - event.clientX),
                            });
                        }
                    }
                    if (
                        event.clientY <
                        containercrop.offset().top + containerheight
                    ) {
                        if (
                            (parent.position().top + parent.height() <
                                containercrop.height() &&
                                parent.position().left + parent.width() <
                                    containercrop.width()) ||
                            deltaY > 0
                        ) {
                            newheight = startHeightcrop - deltaY;
                        }
                    }
                } else if (dot.data("direction") === "ne") {
                    if (
                        (event.clientX <
                            containercrop.offset().left + containerwidth &&
                            parent.position().left + parent.width() <
                                containercrop.width()) ||
                        deltaX > 0
                    ) {
                        newWidth = startWidthcrop - deltaX;
                    }
                    if (event.clientY > containercrop.offset().top) {
                        if (
                            (parent.position().top + parent.height() <
                                containercrop.height() &&
                                parent.position().left + parent.width() <
                                    containercrop.width()) ||
                            deltaY < 0
                        ) {
                            newheight = startHeightcrop + deltaY;
                            parent.offset({
                                top:
                                    startTopcrop - (startYcrop - event.clientY),
                            });
                        }
                    }
                } else if (dot.data("direction") === "nw") {
                    if (event.clientX > containercrop.offset().left) {
                        if (
                            parent.position().left + parent.width() <
                                containercrop.width() ||
                            deltaX < 0
                        ) {
                            newWidth = startWidthcrop + deltaX;
                            parent.offset({
                                left:
                                    startLeftcrop -
                                    (startXcrop - event.clientX),
                            });
                        }
                    }
                    if (event.clientY > containercrop.offset().top) {
                        if (
                            (parent.position().top + parent.height() <
                                containercrop.height() &&
                                parent.position().left + parent.width() <
                                    containercrop.width()) ||
                            deltaY < 0
                        ) {
                            newheight = startHeightcrop + deltaY;
                            parent.offset({
                                top:
                                    startTopcrop - (startYcrop - event.clientY),
                            });
                        }
                    }
                }

                if (dot.data("direction") === "n") {
                    let newHeight = startHeightcrop + deltaY;
                    let newTop = startTopcrop - (startYcrop - event.clientY);
                    if (newHeight > 0) {
                        if (event.clientY > containercrop.offset().top) {
                            if (
                                parent.position().top + parent.height() <
                                    containercrop.height() ||
                                deltaY < 0
                            ) {
                                parent.height(newHeight);
                                parent.offset({ top: newTop });
                            }
                        }
                    }
                } else if (dot.data("direction") === "s") {
                    let newHeight = startHeightcrop - deltaY;

                    if (newHeight > 0) {
                        if (
                            event.clientY <
                            containercrop.offset().top +
                                containercrop[0].getBoundingClientRect().height
                        ) {
                            if (
                                parent.position().top + parent.height() <
                                    containercrop.height() ||
                                deltaY > 0
                            ) {
                                parent.height(newHeight);
                            }
                        }
                    }
                }
                if (dot.data("direction") === "w") {
                    let newWidth = startWidthcrop + deltaX;
                    let newLeft = startLeftcrop - (startXcrop - event.clientX);
                    if (newWidth > 0) {
                        if (event.clientX > containercrop.offset().left) {
                            if (
                                parent.position().left + parent.width() <
                                    containercrop.width() ||
                                deltaX < 0
                            ) {
                                parent.width(newWidth);
                                parent.offset({ left: newLeft });
                            }
                        }
                    }
                } else if (dot.data("direction") === "e") {
                    let newWidth = startWidthcrop - deltaX;
                    if (newWidth > 0) {
                        if (
                            event.clientX <
                            containercrop.offset().left + containerwidth
                        ) {
                            if (
                                parent.position().left + parent.width() <
                                    containercrop.width() ||
                                deltaX > 0
                            ) {
                                parent.width(newWidth);
                                //parent.find('.sl-block-element').css({right:(crop*-1)})
                            }
                        }
                    }
                }
                newheight ? parent.height(newheight) : "";
                newWidth ? parent.width(newWidth) : "";
            }
        };
        /**
         * Function to handle the mouse release event for cropping.
         * @param {Event} event - The mouse release event.
         * @returns None
         */
        mouserelesecrop = function (event) {
            if (mouseMovedcrop) {
                //('in relese');
                $(".reveal").unbind("mousemove", mousemovecrop);
                $(".reveal").unbind("mouseup", mouserelesecrop);
                mouseMovedcrop = false;
            }
            isDragcrop = false;
        };

        /**
         * Adds a theme image.
         *
         * @param {type} paramName - description of parameter
         * @return {type} description of return value
         */
        addThemeImage = function (e, that) {
            let imageurl = $(that)
                .data("json").url;
            $(that).find("i").hide();
            $(that).find("img").show();
            $("#customTheme .display-screen").css(
                "background-image",
                "url(" + imageurl + ")"
            );
            $("#upload-theme-background").val(null);
            setTimeout(() => {
                $(that).find("i").show();
                $(that).find("img").hide();
            }, 1500);
        };

        $(document).on("change", "#upload-theme-background", function (e) {
            let file = $(this)[0].files[0];
            var reader = new FileReader();
            let that = this;
            reader.onloadend = function () {
                $(that).parent().find("#upload-theme-background-logo").show();
                $(that).parent().find("#upload-theme-background-loader").hide();
                $("#customTheme .display-screen").css(
                    "background-image",
                    "url(" + reader.result + ")"
                );
            };
            if (file) {
                $(this).parent().find("#upload-theme-background-logo").hide();
                $(this).parent().find("#upload-theme-background-loader").show();
                reader.readAsDataURL(file);
            } else {
            }
        });

        uploadImage = async function (image) {
            return new Promise(function (resolve, reject) {
                let formData = new FormData();
                formData.append("file", image);
                formData.append("token", $("#course-token").val());
                $.ajax({
                    url: $("#image-upload-url").val(),
                    method: "POST",
                    data: formData,
                    processData: false,
                    contentType: false,
                    async: true,
                    beforeSend: function () {
                        $(".popup_loader").show();
                    },
                    success: function (response) {
                        resolve(response);
                    },
                    error: function (error) {
                        reject(error);
                    },
                    complete: function () {
                        setTimeout(() => {
                            $(".popup_loader").hide();
                        }, 1000);
                    },
                });
            });
        };
        updateReplaceimage = function () {
            let isChecked = $(".image-replace").prop("checked");

            getElementJson(
                Reveal.getSlidePastCount(),
                getCurrentElement().data("id")
            ).is_replace = isChecked;
        };
            updateReplaceimageIcon = function () {
            let isChecked = $(".image-replace-icon").prop("checked");

            getElementJson(
                Reveal.getSlidePastCount(),
                getCurrentElement().data("id")
            ).is_replace_icon = isChecked;
        };
        updateImageOpacity = function (inputElement) {
            const opacityValue = parseFloat($(inputElement).val());

            const currentElement = getCurrentElement();
            const targetContent = currentElement.find(".sl-block-content");

            targetContent.css("opacity", opacityValue);
            $(document).trigger("elementeupdate");
        };

        updateBackgroundImageOpacity = function (that) {
            var opacity = $(that).val();
            var applyToAll = $("#image-apply-to-all").prop("checked");
            if (applyToAll) {
                // Apply opacity to all slides
                if (Reveal && Reveal.course && Reveal.course.slides) {
                    Reveal.course.slides.forEach(function (slide, idx) {
                        slide.background = slide.background || {};
                        slide.background.opacity = opacity;
                        // Update DOM if slide is loaded
                        var domSlide = Reveal.getSlides()[idx];
                        if (domSlide) {
                            domSlide.setAttribute(
                                "data-background-opacity",
                                opacity
                            );
                        }
                    });
                    Reveal.sync();
                }
            } else {
                // Only current slide
                var currentSlide = Reveal.getCurrentSlide();
                if (currentSlide) {
                    currentSlide.setAttribute(
                        "data-background-opacity",
                        opacity
                    );
                    if (Reveal.course && Reveal.course.slides) {
                        Reveal.course.slides[
                            deck.getSlidePastCount()
                        ].background =
                            Reveal.course.slides[deck.getSlidePastCount()]
                                .background || {};
                        Reveal.course.slides[
                            deck.getSlidePastCount()
                        ].background.opacity = opacity;
                    }
                    Reveal.syncSlide(currentSlide);
                }
            }
            $(document).trigger("slideupdate", {
                slidenum: deck.getSlidePastCount() + 1,
                onlythumb: true,
            });
            //$(document).trigger("elementeupdate");
        };
    },
};
