import {Component, OnDestroy} from '@angular/core';
import {IonicPage, NavController, NavParams, ToastController} from 'ionic-angular';
import {Observable} from 'rxjs/Observable';
import {Config} from '../../store/states/config';
import {Store} from '@ngrx/store';
import {AppState} from '../../app/app.state';
import {APP_REFRESH, AppService} from '../../app/app.service';
import {HttpClient} from '@angular/common/http';
import {KeyHelper} from '../../helpers/key-helper';
import {Transaction} from '../../store/states/transaction';
import {TransactionType} from '../../store/states/transaction-type';
import {FormBuilder, FormControl, FormGroup, Validators} from '@angular/forms';

/**
 * Generated class for the SendTokensPage page.
 *
 * See https://ionicframework.com/docs/components/#navigation for more info on
 * Ionic pages and navigation.
 */

@IonicPage()
@Component({
    selector: 'page-send-tokens',
    templateUrl: 'send-tokens.html',
})
export class SendTokensPage implements OnDestroy {

    /**
     * Class level-declarations.
     */
    public configState: Observable<Config>;
    public config: Config;
    public configSubscription: any;
    public id: string;
    public keyHelper = KeyHelper;
    public formGroup: FormGroup;
    public sending = false;
    public error: string = null;

    /**
     *
     * @param {NavController} navCtrl
     * @param {NavParams} navParams
     * @param {AppService} appService
     * @param {Store<AppState>} store
     * @param {ToastController} toastController
     * @param {HttpClient} httpClient
     * @param {FormBuilder} formBuilder
     */
    constructor(public navCtrl: NavController, public navParams: NavParams, private appService: AppService, private store: Store<AppState>, private toastController: ToastController, private httpClient: HttpClient, formBuilder: FormBuilder) {
        this.configState = this.store.select('config');
        this.configSubscription = this.configState.subscribe((config: Config) => {
            this.config = config;
        });
        this.formGroup = formBuilder.group({
            to: new FormControl('', Validators.compose([Validators.required, Validators.minLength(40), Validators.pattern(/^[0-9a-fA-F]+$/)])),
            tokens: new FormControl(0, Validators.compose([Validators.required, Validators.min(1)]))
        });
        this.formGroup.get('to').valueChanges.subscribe(value => {
            if (!value || value === '') {
                return;
            }

            if (!/^[0-9a-fA-F]+$/.test(value) || value.length > 40) {
                this.error = 'Invalid private key';
                this.formGroup.get('to').setValue(null);
                return;
            }
            this.error = null;
        });
    }

    /**
     *
     */
    ionViewDidLoad() {
    }

    /**
     *
     */
    ngOnDestroy() {
        this.configSubscription.unsubscribe();
    }

    /**
     *
     */
    public send(): void {
        if (this.sending) {
            return;
        }

        // Create transaction.
        const transaction: Transaction = {
            type: TransactionType.TransferTokens,
            from: this.config.defaultAccount.address,
            to: this.formGroup.get('to').value,
            value: parseInt(this.formGroup.get('tokens').value, 10)
        } as any;
        this.appService.hashAndSign(this.config.defaultAccount.privateKey, transaction);

        this.sending = true;
        const url = 'http://' + this.config.delegates[0].endpoint.host + ':1975/v1/transactions';
        this.httpClient.post(url, JSON.stringify(transaction), {headers: {'Content-Type': 'application/json'}}).subscribe((response: any) => {
            this.id = response.id;
            this.getStatus();
        });
    }

    /**
     *
     */
    private getStatus(): void {
        setTimeout(() => {
            this.appService.getStatus(this.id).subscribe(response => {
                if (response.status === 'Pending') {
                    this.getStatus();
                    return;
                }

                this.sending = false;
                let toast = this.toastController.create({
                    message: response.status === 'Ok' ? 'Tokens Sent' : response.status,
                    duration: 3000,
                    position: 'top'
                });
                toast.present();

                if (response.status === 'Ok') {
                    this.navCtrl.pop();
                    this.appService.appEvents.emit({type: APP_REFRESH});
                }
            });
        }, 500);
    }
}
