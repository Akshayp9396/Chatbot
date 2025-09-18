// import { NgModule } from '@angular/core';
// import { BrowserModule } from '@angular/platform-browser';

// // import { AppRoutingModule } from './app-routing.module';
// import { AppComponent } from './app.component';


// @NgModule({
//   declarations: [
//     AppComponent,

//   ],
//   imports: [
//     BrowserModule,
//     // AppRoutingModule
//   ],
//   providers: [],
//   bootstrap: [AppComponent]
// })
// export class AppModule { }


// import { NgModule } from '@angular/core';
// import { BrowserModule } from '@angular/platform-browser';
// import { FormsModule } from '@angular/forms';            // <-- add this

// import { AppRoutingModule } from './app-routing.module';
// import { AppComponent } from './app.component';

// @NgModule({
//   declarations: [AppComponent],
//   imports: [
//     BrowserModule,
//     FormsModule,                                        // <-- and this
//     AppRoutingModule                                   // (ok to keep even if unused)
//   ],
//   providers: [],
//   bootstrap: [AppComponent]
// })
// export class AppModule {}



import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';  // <-- add this

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,   // <-- add this
    // AppRoutingModule    // ok to keep even if unused
  ],
  bootstrap: [AppComponent]
})
export class AppModule {}


