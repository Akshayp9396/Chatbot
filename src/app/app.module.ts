

import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';  // <-- add this

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

// Lottie
import { LottieModule } from 'ngx-lottie';
import player from 'lottie-web';

export function playerFactory() {
  return player;
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,   // <-- add this
    // AppRoutingModule    // ok to keep even if unused
  
     LottieModule.forRoot({ player: playerFactory })
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}




