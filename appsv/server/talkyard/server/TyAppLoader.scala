package talkyard.server

import scala.collection.Seq
import com.debiki.core._
import debiki.{Globals, RateLimiter, Nashorn}
import talkyard.server.http.{PlainApiActions, SafeActions}
import talkyard.server.security.EdSecurity
import play.api._
import play.api.http.FileMimeTypes
import play.api.libs.ws.ahc.AhcWSComponents
import play.api.mvc.{ControllerComponents, EssentialFilter}
import play.api.routing.Router
import scala.concurrent.{ExecutionContext, Future}
import generatedcode.BuildInfo

private object LogVals {
  val talkyardVersion = s"${BuildInfo.dockerTag} Git rev ${BuildInfo.gitRevision}"
  def systemNowIsoNoT() = Prelude.toIso8601NoT(System.currentTimeMillis())
}

class TyAppLoader extends ApplicationLoader {

  private val logger = TyLogger("TyAppLoader")
  import LogVals._

  def load(context: ApplicationLoader.Context): Application = {
    LoggerConfigurator(context.environment.classLoader).foreach {
      _.configure(context.environment, context.initialConfiguration, Map.empty)
    }

    val isProd = context.environment.mode == play.api.Mode.Prod
    Globals.setIsProdForever(isProd)

    logger.info(s"Starting Talkyard $talkyardVersion at ${systemNowIsoNoT()}, ${
          if (isProd) "prod" else "dev/test"} mode ... [TyMHELLO]")
    val app = new TyAppComponents(context).application
    logger.info("Started. [TyMSTARTED]")
    app
  }

}

class TyAppComponents(appLoaderContext: ApplicationLoader.Context)
  extends BuiltInComponentsFromContext(appLoaderContext)
  with AhcWSComponents
  with _root_.controllers.AssetsComponents {

  private val logger = TyLogger("TyAppComponents")

  actorSystem registerOnTermination {
    logger.info("Akka actor system has shut down. [TyMACTRSGONE]")
  }

  // Could instead extend HttpFiltersComponents, but it adds a weird localhost-only filter.
  SECURITY // it adds some maybe-useful security related filters too, investigate if should use them.
  override def httpFilters: Seq[EssentialFilter] = Seq(TyFilters.makeGzipFilter(materializer))

  // Jaeger docs: https://github.com/yurishkuro/opentracing-tutorial/tree/master/java
  val tracer: io.jaegertracing.internal.JaegerTracer = {
    import io.jaegertracing.Configuration.JAEGER_SERVICE_NAME
    val tracerServiceName =
      Option(System.getProperty(JAEGER_SERVICE_NAME, System.getenv(JAEGER_SERVICE_NAME)))
        .getOrElse("ty-app")
    io.jaegertracing.Configuration.fromEnv(tracerServiceName).getTracer
  }

  val globals = new Globals(appLoaderContext, executionContext, wsClient, actorSystem, tracer)
  val security = new talkyard.server.security.EdSecurity(globals)
  val rateLimiter = new RateLimiter(globals, security)
  val safeActions = new SafeActions(globals, security, controllerComponents.parsers)
  val plainApiActions = new PlainApiActions(safeActions, globals, security, rateLimiter)
  val nashorn = new Nashorn(globals)

  val tyCtx = new TyContext(
        globals, security, safeActions, plainApiActions, nashorn,
        materializer, controllerComponents)

  globals.setEdContext(tyCtx)
  globals.startStuff()

  applicationLifecycle.addStopHook { () =>
    Future.successful {
      import LogVals._
      logger.info(s"Shutting down Talkyard $talkyardVersion at ${systemNowIsoNoT()} ... [EsMBYESOON]")
      tracer.close()
      globals.stopStuff()
      logger.info("Done shutting down. [EsMBYE]")
    }
  }

  // (Cannot:  import _root_.{controllers => c} because cannot incl _root_ in an import, apparently.)

  private def cc = controllerComponents

  val loginController = new _root_.controllers.LoginController(cc, tyCtx)
  val loginWithOpenAuthController = new _root_.controllers.LoginWithOpenAuthController(cc, tyCtx)
  val sitePatchController = new _root_.talkyard.server.sitepatch.SitePatchController(cc, tyCtx)

  lazy val router: Router = new _root_.router.Routes(
    httpErrorHandler,
    loginController,
    new _root_.controllers.LoginAsGuestController(cc, tyCtx),
    new _root_.controllers.LoginWithPasswordController(cc, tyCtx),
    loginWithOpenAuthController,
    new _root_.controllers.ImpersonateController(cc, tyCtx, loginController),
    new talkyard.server.pubsub.SubscriberController(cc, tyCtx),
    new _root_.controllers.EmbeddedTopicsController(cc, tyCtx),
    new _root_.controllers.SearchController(cc, tyCtx),
    new _root_.controllers.ResetPasswordController(cc, tyCtx),
    new _root_.controllers.CreateSiteController(cc, tyCtx),
    new _root_.controllers.AdminController(cc, tyCtx),
    new _root_.controllers.SettingsController(cc, tyCtx),
    new _root_.controllers.LegalController(cc, tyCtx),
    new _root_.controllers.SpecialContentController(cc, tyCtx),
    new _root_.controllers.ModerationController(cc, tyCtx),
    new _root_.controllers.UserController(cc, tyCtx),
    new talkyard.server.sess.SessionController(cc, tyCtx),
    new _root_.controllers.UnsubscriptionController(cc, tyCtx),
    new _root_.talkyard.server.summaryemails.UnsubFromSummariesController(cc, tyCtx),
    new _root_.controllers.InviteController(cc, tyCtx),
    new _root_.controllers.ForumController(cc, tyCtx),
    new _root_.controllers.PageController(cc, tyCtx),
    new _root_.talkyard.server.talk.PostsController(cc, tyCtx),
    new _root_.controllers.ReplyController(cc, tyCtx),
    new _root_.controllers.DraftsController(cc, tyCtx),
    new _root_.controllers.CustomFormController(cc, tyCtx),
    new _root_.talkyard.server.plugins.utx.UsabilityTestingExchangeController(cc, tyCtx),
    new _root_.controllers.VoteController(cc, tyCtx),
    new _root_.controllers.FlagController(cc, tyCtx),
    new _root_.controllers.EditController(cc, tyCtx),
    new _root_.controllers.PageTitleSettingsController(cc, tyCtx),
    new _root_.controllers.GroupTalkController(cc, tyCtx),
    new _root_.controllers.UploadsController(cc, tyCtx),
    new _root_.controllers.CloseCollapseController(cc, tyCtx),
    sitePatchController,
    new _root_.controllers.DebugTestController(cc, tyCtx),
    new _root_.controllers.SiteAssetBundlesController(cc, tyCtx),
    new _root_.controllers.TagsController(cc, tyCtx),
    new _root_.talkyard.server.emails.in.EmailsInController(cc, tyCtx),
    new _root_.controllers.SuperAdminController(cc, tyCtx),
    new _root_.talkyard.server.events.WebhooksController(cc, tyCtx),
    new _root_.controllers.ApiSecretsController(cc, tyCtx),
    new _root_.talkyard.server.authn.SsoAuthnController(cc, tyCtx),
    new _root_.talkyard.server.api.GetController(cc, tyCtx),
    new _root_.talkyard.server.api.ListController(cc, tyCtx),
    new _root_.talkyard.server.api.QueryDoController(cc, tyCtx),
    new _root_.controllers.ApiV0Controller(cc, tyCtx, sitePatchController),
    //new _root_.controllers.Application(cc, tyCtx),
    new _root_.controllers.ViewPageController(cc, tyCtx))

}


class TyContext(
  val globals: Globals,
  val security: EdSecurity,
  val safeActions: SafeActions,
  val plainApiActions: PlainApiActions,
  val nashorn: Nashorn,
  val akkaStreamMaterializer: akka.stream.Materializer,
  // Hide so fewer parts of the app get access to Play's internal stuff.
  private val controllerComponents: ControllerComponents) {

  val postRenderer = new talkyard.server.PostRenderer(nashorn)

  def rateLimiter: RateLimiter = plainApiActions.rateLimiter

  implicit def executionContext: ExecutionContext = controllerComponents.executionContext
  def mimeTypes: FileMimeTypes = controllerComponents.fileMimeTypes

}
