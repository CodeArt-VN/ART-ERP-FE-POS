import { Component } from '@angular/core';
import { NavController, ModalController, AlertController, LoadingController, PopoverController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import { EnvService } from 'src/app/services/core/env.service';
import { PageBase } from 'src/app/page-base';
import { POS_TableProvider, BRA_BranchProvider, SALE_OrderProvider } from 'src/app/services/static/services.service';
import { Location } from '@angular/common';
import { CommonService } from 'src/app/services/core/common.service';
import { ApiSetting } from 'src/app/services/static/api-setting';
import { TranslateService } from '@ngx-translate/core';

@Component({
    selector: 'app-pos-welcome',
    templateUrl: 'pos-welcome.page.html',
    styleUrls: ['pos-welcome.page.scss']
})
export class POSWelcomePage extends PageBase {
    idTable = this.route.snapshot.paramMap.get('id');
    currentBranch: any;
    Table;
    isLanguageModalOpen = false;
    constructor(
        //public pageProvider: POS_TableProvider,
       
        public modalController: ModalController,
        public popoverCtrl: PopoverController,
        public alertCtrl: AlertController,
        public loadingController: LoadingController,
        public env: EnvService,
        public navCtrl: NavController,
        public location: Location,
        public route: ActivatedRoute,
        public commonService: CommonService,
        public translate: TranslateService
    ) {
        super();
        this.isLanguageModalOpen = true;
    }

    dummyRemark = "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500"

    Note = {
        Note1: `DÀNH CHO KHÁCH HÀNG`,
        Note2: `- Khách hàng đặt món, thanh toán và dùng món tại quầy/ tại bàn, nếu có vấn đề gì cần hổ trợ, vui lòng liên hệ thu ngân hoặc gọi số hotline 090 133 5553`,
        Note3: `- Khách hàng nhận hàng tại quầy hoặc tại bàn.`,
        Note4: `CN Công ty CP IN Hospitality`,
        Note5: `Số điện thoại: 090 133 5553. Email: cskh@gemcafe.com.vn`,
    };

    SlidingCard = [
        {
            Logo: '',
            Splash: '',
            Header: 'Welcome!',
            Remark: "Chào mừng bạn đã đến với ứng dụng đặt món tại bàn.",
            Note: this.Note
        },
        {
            Logo: '',
            Splash: 'assets/intro-screen/intro-2.jpg',
            Header: 'Gọi món dễ dàng',
            Remark: 'Chỉ với vài thao tác đơn giản, nhà hàng đã sẵn sàng để phục vụ món cho bạn.'
        },
        {
            Logo: '',
            Splash: 'assets/intro-screen/intro-4.webp',
            Header: 'Luôn luôn sẵn sàng',
            Remark: 'Không phải chờ đợi được phục vụ, bạn luôn chủ động trong việc gọi món cho mình.'
        }
    ]

    slideOptsDefault = {
        initialSlide: 0,
        speed: 400,
        loop: true,
        autoplay: 2000,
    };

    slideOptsFade = {
        on: {
            beforeInit() {
                const swiper = this;
                swiper.classNames.push(`${swiper.params.containerModifierClass}fade`);
                const overwriteParams = {
                    slidesPerView: 1,
                    slidesPerColumn: 1,
                    slidesPerGroup: 1,
                    watchSlidesProgress: true,
                    spaceBetween: 0,
                    virtualTranslate: true,
                };
                swiper.params = Object.assign(swiper.params, overwriteParams);
                swiper.params = Object.assign(swiper.originalParams, overwriteParams);
            },
            setTranslate() {
                const swiper = this;
                const { slides } = swiper;
                for (let i = 0; i < slides.length; i += 1) {
                    const $slideEl = swiper.slides.eq(i);
                    const offset$$1 = $slideEl[0].swiperSlideOffset;
                    let tx = -offset$$1;
                    if (!swiper.params.virtualTranslate) tx -= swiper.translate;
                    let ty = 0;
                    if (!swiper.isHorizontal()) {
                        ty = tx;
                        tx = 0;
                    }
                    const slideOpacity = swiper.params.fadeEffect.crossFade
                        ? Math.max(1 - Math.abs($slideEl[0].progress), 0)
                        : 1 + Math.min(Math.max($slideEl[0].progress, -1), 0);
                    $slideEl
                        .css({
                            opacity: slideOpacity,
                        })
                        .transform(`translate3d(${tx}px, ${ty}px, 0px)`);
                }
            },
            setTransition(duration) {
                const swiper = this;
                const { slides, $wrapperEl } = swiper;
                slides.transition(duration);
                if (swiper.params.virtualTranslate && duration !== 0) {
                    let eventTriggered = false;
                    slides.transitionEnd(() => {
                        if (eventTriggered) return;
                        if (!swiper || swiper.destroyed) return;
                        eventTriggered = true;
                        swiper.animating = false;
                        const triggerEvents = ['webkitTransitionEnd', 'transitionend'];
                        for (let i = 0; i < triggerEvents.length; i += 1) {
                            $wrapperEl.trigger(triggerEvents[i]);
                        }
                    });
                }
            },
        },
    };

    slideOptsFlip = {
        on: {
            beforeInit() {
                const swiper = this;
                swiper.classNames.push(`${swiper.params.containerModifierClass}flip`);
                swiper.classNames.push(`${swiper.params.containerModifierClass}3d`);
                const overwriteParams = {
                    slidesPerView: 1,
                    slidesPerColumn: 1,
                    slidesPerGroup: 1,
                    watchSlidesProgress: true,
                    spaceBetween: 0,
                    virtualTranslate: true,
                };
                swiper.params = Object.assign(swiper.params, overwriteParams);
                swiper.originalParams = Object.assign(swiper.originalParams, overwriteParams);
            },
            setTranslate() {
                const swiper = this;
                const { $, slides, rtlTranslate: rtl } = swiper;
                for (let i = 0; i < slides.length; i += 1) {
                    const $slideEl = slides.eq(i);
                    let progress = $slideEl[0].progress;
                    if (swiper.params.flipEffect.limitRotation) {
                        progress = Math.max(Math.min($slideEl[0].progress, 1), -1);
                    }
                    const offset$$1 = $slideEl[0].swiperSlideOffset;
                    const rotate = -180 * progress;
                    let rotateY = rotate;
                    let rotateX = 0;
                    let tx = -offset$$1;
                    let ty = 0;
                    if (!swiper.isHorizontal()) {
                        ty = tx;
                        tx = 0;
                        rotateX = -rotateY;
                        rotateY = 0;
                    } else if (rtl) {
                        rotateY = -rotateY;
                    }

                    $slideEl[0].style.zIndex = -Math.abs(Math.round(progress)) + slides.length;

                    if (swiper.params.flipEffect.slideShadows) {
                        // Set shadows
                        let shadowBefore = swiper.isHorizontal()
                            ? $slideEl.find('.swiper-slide-shadow-left')
                            : $slideEl.find('.swiper-slide-shadow-top');
                        let shadowAfter = swiper.isHorizontal()
                            ? $slideEl.find('.swiper-slide-shadow-right')
                            : $slideEl.find('.swiper-slide-shadow-bottom');
                        if (shadowBefore.length === 0) {
                            shadowBefore = swiper.$(
                                `<div class="swiper-slide-shadow-${swiper.isHorizontal() ? 'left' : 'top'}"></div>`
                            );
                            $slideEl.append(shadowBefore);
                        }
                        if (shadowAfter.length === 0) {
                            shadowAfter = swiper.$(
                                `<div class="swiper-slide-shadow-${swiper.isHorizontal() ? 'right' : 'bottom'}"></div>`
                            );
                            $slideEl.append(shadowAfter);
                        }
                        if (shadowBefore.length) shadowBefore[0].style.opacity = Math.max(-progress, 0);
                        if (shadowAfter.length) shadowAfter[0].style.opacity = Math.max(progress, 0);
                    }
                    $slideEl.transform(`translate3d(${tx}px, ${ty}px, 0px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`);
                }
            },
            setTransition(duration) {
                const swiper = this;
                const { slides, activeIndex, $wrapperEl } = swiper;
                slides
                    .transition(duration)
                    .find(
                        '.swiper-slide-shadow-top, .swiper-slide-shadow-right, .swiper-slide-shadow-bottom, .swiper-slide-shadow-left'
                    )
                    .transition(duration);
                if (swiper.params.virtualTranslate && duration !== 0) {
                    let eventTriggered = false;
                    // eslint-disable-next-line
                    slides.eq(activeIndex).transitionEnd(function onTransitionEnd() {
                        if (eventTriggered) return;
                        if (!swiper || swiper.destroyed) return;

                        eventTriggered = true;
                        swiper.animating = false;
                        const triggerEvents = ['webkitTransitionEnd', 'transitionend'];
                        for (let i = 0; i < triggerEvents.length; i += 1) {
                            $wrapperEl.trigger(triggerEvents[i]);
                        }
                    });
                }
            },
        },
    };

  
    currentOrderList;
    matchOrder;
    slidesElement: any;
    getSliders(slides) {
           
        let apiPath = {
            method: "GET",
            url: function(id){return ApiSetting.apiDomain("POS/ForCustomer/Welcome/") + id} 
        };            
        this.commonService.getAnItemOnServer(parseInt(this.idTable),"",apiPath).then((result:any)=>{
            this.currentBranch = result.Branch;
            this.env.branchList.push(this.currentBranch);
            this.env.selectedBranch = this.currentBranch.Id;

            this.SlidingCard.forEach(s => {
                s.Logo = this.currentBranch?.LogoURL;
            });
        });
        // this.pageProvider.read({ Id: this.idTable }).then((result: any) => {
        //     if (result) {
        //         this.branchProvider.read({Id: result.data[0].IDBranch}).then((branch: any) =>{
        //             this.currentBranch = branch.data[0];
        //             this.env.branchList.push(this.currentBranch);
        //             this.env.selectedBranch = this.currentBranch.Id;
        //             // if (this.currentBranch.LogoURL) {
        //             //     this.currentBranch.LogoURL = 'assets/logos/logo-the-log-hine-wine.png';
        //             // }

        //             // this.getOrderList().then((data: any) => {
        //             //     this.currentOrderList = data.data;

        //             //     this.matchOrder = this.currentOrderList.filter(c => c.Tables == this.idTable);
        //             // });

        //         });

        //     }
        // })

        this.slidesElement = slides;

        setInterval(() => {
            this.slidesElement.slideNext()
        }, 8000);
        // debugger
    }

    // getOrderList() {
    //     return new Promise((resolve, reject) => {
    //         this.saleOrderProvider.read({ Keyword: '', Take: 5000, Skip: 0, Status: "New", Type: "POSOrder"}).then(data => {
    //             resolve(data);
    //         });
    //     });
    // }
    preLoadData(event?: any): void {
        //let forceReload = event === 'force';{{currentBranch?.LogoURL}}
        
        Promise.all([
            this.getTable(),
        ]).then((values: any) => {
            this.Table = values[0];
            super.preLoadData(event);
        }).catch(err => {
            this.loadedData(event);
        })
    }
    async closeWelcome() {
        if(this.Table.IsAllowMultipleOrder == true){
            this.navCtrl.navigateForward('/pos-customer-order/0/'+ this.idTable);
        }
        else{
            let apiPath = { method: "GET",url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/OrderOfTable/") + id }};
            this.commonService.connect(apiPath.method, apiPath.url(this.idTable), this.query).toPromise().then(result=>{
                if(result){               
                    this.navCtrl.navigateForward('/pos-customer-order/'+result+'/'+ this.idTable);
                }
                else{
                    this.navCtrl.navigateForward('/pos-customer-order/0/'+ this.idTable);
                }
            }).catch(err => {});
        }    
    }
    private getTable() {
        let apiPath = {
            method: "GET",
            url: function (id) { return ApiSetting.apiDomain("POS/ForCustomer/Table/") + id }
        };
        return new Promise((resolve, reject) => {
            this.commonService.connect(apiPath.method, apiPath.url(this.idTable), this.query).toPromise()
                .then((result: any) => {
                    resolve(result);
                })
                .catch(err => {
                    reject(err);
                });
        });
    }

    changeLanguage(lang = null) {
		if (lang) {
			this.translate.use(lang);
		}
		else {
			if (this.translate.currentLang != 'vi-VN') {
				this.translate.use('vi-VN');
			}
			else {
				this.translate.use('en-US')
			}

			this.env.setStorage('lang', this.translate.currentLang);
		}
        this.prepareSlides();
	}

    prepareSlides() {
        Promise.all([
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.for-customer').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.note2').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.note3').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.note4').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.note5').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.header1').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.remark1').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.header2').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.remark2').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.header3').toPromise(),
            this.translate.get('erp.app.pages.pos.pos-customer-welcome.remark3').toPromise(),
        ]).then(trans => {
            this.Note.Note1 = trans[0];
            this.Note.Note2 = trans[1];
            this.Note.Note3 = trans[2];
            this.Note.Note4 = trans[3];
            this.Note.Note5 = trans[4];
            this.SlidingCard[0].Header = trans[5];
            this.SlidingCard[0].Remark = trans[6];
            this.SlidingCard[1].Header = trans[7];
            this.SlidingCard[1].Remark = trans[8];
            this.SlidingCard[2].Header = trans[9];
            this.SlidingCard[2].Remark = trans[10];
        })
    }
}

