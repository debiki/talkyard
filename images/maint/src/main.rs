use axum::{
    http::StatusCode,
    response::{Html, IntoResponse},
    //routing::get,
    Router,
};
use std::env;
use std::fs;
use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "maint=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let app = Router::new(); // .route("/", get(handler));

    let maint_msg_html_str: String = fs::read_to_string("./maint-msg.html")
        .expect("File ./maint-msg.html missing");

    let any_cust_status_code: Option<StatusCode> = env::var("TY_MAINT_STATUS_CODE").map(|code_str| {
        // StatusCode::from_str(&code_str).unwrap();  no, from_str doesn't exist, although it does.
        let status_code_u16: u16 = code_str.parse().unwrap_or_else(|_| {
            panic!("TY_MAINT_STATUS_CODE is not an u16 integer number, it is: {}", code_str);
        });
        if status_code_u16 < 100 || 999 < status_code_u16 {
            panic!("TY_MAINT_STATUS_CODE is not a valid HTTP status code, it is: {}", status_code_u16);
        }
        StatusCode::from_u16(status_code_u16).unwrap()
    }).ok();

    let status_code = any_cust_status_code.unwrap_or(StatusCode::SERVICE_UNAVAILABLE);

    let respond_service_unavailable = move || async move {
        (status_code, Html(maint_msg_html_str))
    };

    let app = app.fallback(respond_service_unavailable);

    // Listen on all interfaces. We'll use Docker to bind port 80 and 443 to 8080.
    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    tracing::info!("Listening on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();

    tracing::info!("Shutting down.");
}

async fn handler() -> Html<&'static str> {
    Html("<h1>Hello</h1>
         <p>or should I say Hi? Or Hello? Hmm. Let's try again.
           <b>You there</b>, yes you, what do you prefer, Hi or Hello?</p>")
}
